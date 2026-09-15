/**
 * AzureSQL.gs — Conexão JDBC com Azure SQL (serviço Jdbc do Apps Script).
 * Mesmo mecanismo do projeto gas-deploy (mesma base). Sem credenciais, o
 * sistema opera em modo mock.
 *
 * ⚠️ FIREWALL DO AZURE — causa nº 1 de falha aqui. Apps Script conecta a
 * partir dos IPs do Google (dinâmicos); "Permitir serviços do Azure" NÃO
 * cobre o Google. Se testarConexao() travar em timeout, é quase sempre isto.
 */
var AzureSQL = (function () {

  var QUERY_TIMEOUT = 30; // segundos — não aumentar sem testar, ver nota do gas-deploy

  function connect() {
    var c = Config.azureCreds();
    if (!c.url) {
      throw new Error('Credenciais do Azure SQL não configuradas (Script Properties). ' +
        'Rode setupCredentials() no editor do Apps Script.');
    }
    return Jdbc.getConnection(c.url, c.user, c.password);
  }

  function bind(stmt, params) {
    for (var i = 0; i < params.length; i++) {
      var v = params[i];
      if (v === null || v === undefined) stmt.setString(i + 1, null);
      else if (typeof v === 'number') {
        if (v === Math.floor(v)) stmt.setInt(i + 1, v);
        else stmt.setDouble(i + 1, v);
      }
      else if (typeof v === 'boolean') stmt.setBoolean(i + 1, v);
      else stmt.setString(i + 1, String(v));
    }
  }

  /** SELECT parametrizado lido célula a célula. Lento — prefira queryJson(). */
  function query(q) {
    var sql = typeof q === 'string' ? q : q.sql;
    var params = (typeof q === 'string' ? [] : q.params) || [];

    var conn = connect();
    try {
      var stmt = conn.prepareStatement(sql);
      stmt.setQueryTimeout(QUERY_TIMEOUT);
      bind(stmt, params);

      var rs = stmt.executeQuery();
      var meta = rs.getMetaData();
      var cols = meta.getColumnCount();
      var labels = [];
      for (var c = 1; c <= cols; c++) labels.push(meta.getColumnLabel(c));

      var out = [];
      while (rs.next()) {
        var row = {};
        for (var k = 0; k < cols; k++) row[labels[k]] = rs.getObject(k + 1);
        out.push(row);
      }
      rs.close();
      stmt.close();
      return out;
    } finally {
      try { conn.close(); } catch (e) { /* conexão já caiu */ }
    }
  }

  /**
   * Mesmo SELECT, mas pede ao SQL Server que devolva o resultado serializado
   * (FOR JSON PATH) — muito mais rápido que ler célula a célula.
   */
  function queryJson(q) {
    var sql = typeof q === 'string' ? q : q.sql;
    var params = (typeof q === 'string' ? [] : q.params) || [];

    var conn = connect();
    try {
      var stmt = conn.prepareStatement(sql + '\nFOR JSON PATH, INCLUDE_NULL_VALUES');
      stmt.setQueryTimeout(QUERY_TIMEOUT);
      bind(stmt, params);

      var rs = stmt.executeQuery();
      var partes = [];
      while (rs.next()) partes.push(rs.getString(1));
      rs.close();
      stmt.close();

      var json = partes.join('');
      return json ? JSON.parse(json) : [];
    } finally {
      try { conn.close(); } catch (e) { /* conexão já caiu */ }
    }
  }

  function queryJsonComFallback(q) {
    try {
      return queryJson(q);
    } catch (e) {
      console.warn('FOR JSON falhou (' + e + '). Lendo célula a célula — vai demorar.');
      return query(q);
    }
  }

  return { query: query, queryJson: queryJson, queryJsonComFallback: queryJsonComFallback };
})();

/**
 * AzureSQLService — regras de acesso a dados de alunos/séries.
 * Normaliza o retorno do banco para o modelo interno. Cache agressivo: dado
 * de referência muda raramente.
 */
var AzureSQLService = (function () {

  function getReferencia(ano) {
    var fixa = Config.filialFixa();

    if (Config.useMock()) {
      return normalize(MockData.linhasAlunos(), fixa);
    }

    var chave = 'ref_' + ano + (fixa ? '_' + fixa : '');
    var hit = Cache.get(chave);
    if (hit && hit.alunos && hit.alunos.length) return hit;

    var rows = AzureSQL.queryJsonComFallback(Queries.alunosPorAno(ano));
    var ref = normalize(rows, fixa);

    if (fixa && rows.length && !ref.alunos.length) {
      var vistas = {};
      rows.forEach(function (r) {
        var u = normalizeUnidade(r.UNIDADE) || '(vazio)';
        vistas[u] = (vistas[u] || 0) + 1;
      });
      throw new Error('FILIAL_FIXA está gravada como "' + fixa + '", que não corresponde a ' +
        'nenhuma unidade da base. Unidades encontradas no ano ' + ano + ': ' +
        JSON.stringify(vistas) + '.');
    }

    if (ref.alunos.length) Cache.put(chave, ref, Config.REF_TTL);
    return ref;
  }

  function getAnos() {
    if (Config.useMock()) {
      var atual = new Date().getFullYear();
      return [atual, atual - 1];
    }
    return Cache.remember('anos_disp', Config.REF_TTL, function () {
      return AzureSQL.queryJsonComFallback(Queries.anosDisponiveis())
        .map(function (r) { return Number(r.ANO); })
        .filter(function (n) { return !isNaN(n); });
    });
  }

  function normalizeUnidade(raw) {
    if (raw == null || raw === '') return '';
    var s = String(raw).trim().toUpperCase()
      .replace(/[ÁÀÂÃ]/g, 'A').replace(/[ÉÊ]/g, 'E').replace(/[Í]/g, 'I')
      .replace(/[ÓÔÕ]/g, 'O').replace(/[Ú]/g, 'U').replace(/[Ç]/g, 'C');
    if (s.indexOf('CHACARA') >= 0) return 'CHACARA';
    if (s.indexOf('MORUMBI') >= 0) return 'MORUMBI';
    return s;
  }

  /** Converte linhas do banco (ou do mock) em {alunos, series}. */
  function normalize(rows, apenasUnidade) {
    var alunos = [], seriesMap = {};

    (rows || []).forEach(function (r) {
      if (r.ALUNO_ID == null) return;
      var unidade = normalizeUnidade(r.UNIDADE);
      if (apenasUnidade && unidade !== apenasUnidade) return;
      var serieId = String(r.SERIE_ID);
      var turmaId = r.TURMA_ID == null ? '' : String(r.TURMA_ID);

      alunos.push({
        id: String(r.ALUNO_ID),
        nome: r.NOME_ALUNO == null ? '' : String(r.NOME_ALUNO),
        serie: r.SERIE_NOME == null ? serieId : String(r.SERIE_NOME),
        turma: r.TURMA_NOME == null || r.TURMA_NOME === '' ? turmaId : String(r.TURMA_NOME),
        unidade: unidade
      });

      if (!seriesMap[serieId]) {
        seriesMap[serieId] = { id: serieId, nome: r.SERIE_NOME == null ? serieId : String(r.SERIE_NOME) };
      }
    });

    return {
      alunos: alunos,
      series: Object.keys(seriesMap).map(function (k) { return seriesMap[k]; }).sort(Domain.compararSeries)
    };
  }

  return { getReferencia: getReferencia, getAnos: getAnos, normalize: normalize };
})();

/**
 * listarColunas — EXECUTAR no editor do Apps Script. Mostra no log os nomes
 * REAIS das colunas de GOLD_REG_DASHBOARD_MAT, pra ajustar Queries.gs se o
 * schema divergir do já confirmado no gas-deploy.
 */
function listarColunas() {
  var colunas;
  try {
    colunas = AzureSQL.query({
      sql: 'SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      params: [Config.TABELA_ALUNOS]
    }).map(function (r) { return r.COLUMN_NAME + ' (' + r.DATA_TYPE + ')'; });
  } catch (e) {
    Logger.log('INFORMATION_SCHEMA indisponível (' + e + '). Lendo 1 linha da tabela.');
    var uma = AzureSQL.query('SELECT TOP 1 * FROM ' + Config.TABELA_ALUNOS);
    colunas = uma.length ? Object.keys(uma[0]) : [];
  }
  Logger.log('Colunas de ' + Config.TABELA_ALUNOS + ' (' + colunas.length + '):');
  colunas.forEach(function (c) { Logger.log('  ' + c); });
  return colunas;
}

/**
 * testarConexao — EXECUTAR no editor pra diagnosticar a conexão com o Azure
 * ANTES de publicar. Mostra no log exatamente onde parou.
 */
function testarConexao() {
  if (Config.useMock()) {
    Logger.log('MODO MOCK ativo — AZURE_SQL_URL não está configurado. Rode setupCredentials() para conectar o Azure.');
    return { ok: true, modo: 'mock' };
  }
  try {
    var anos = AzureSQLService.getAnos();
    Logger.log('✓ Conexão OK. Anos letivos encontrados: ' + anos.join(', '));
    var ano = anos[0] || new Date().getFullYear();
    var ref = AzureSQLService.getReferencia(ano);
    Logger.log('✓ Ano ' + ano + ': ' + ref.alunos.length + ' alunos, ' + ref.series.length + ' séries.');
    return { ok: true, modo: 'azure', anos: anos };
  } catch (e) {
    Logger.log('✗ FALHOU: ' + e);
    Logger.log('Verifique: 1) firewall do Azure libera IPs do Google; 2) URL JDBC correta; ' +
      '3) usuário/senha corretos; 4) tabela ' + Config.TABELA_ALUNOS + ' existe e tem SELECT liberado.');
    throw e;
  }
}
