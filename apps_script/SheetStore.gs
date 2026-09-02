/**
 * SheetStore.gs — Persistência dos registros de prova substitutiva em Google
 * Sheets. A planilha NASCE SOZINHA na primeira gravação (SpreadsheetApp.create),
 * sem precisar de nenhum passo manual — o ID fica gravado em Script Properties
 * (DATA_SPREADSHEET_ID).
 *
 * DIVISÃO DE RESPONSABILIDADE
 *   Azure SQL -> aluno, série, turma, unidade    (somente leitura, é o DW)
 *   Sheets    -> registros de prova substitutiva (leitura e escrita)
 *   Drive     -> arquivo de atestado (ver Anexos.gs) — aqui só a URL
 *
 * Toda escrita passa por LockService: sem isso, duas pessoas salvando ao
 * mesmo tempo sobrescrevem uma a outra.
 */
var SheetStore = (function () {

  var PROP_ID = 'DATA_SPREADSHEET_ID';
  var LOCK_TIMEOUT = 30000;
  var ABA = 'Registros';

  /* Campos antigos mantêm a posição (planilha já em uso não pode reordenar);
     campos novos entram SEMPRE no final — ver ensureSheet(). */
  var COLS = [
    'id', 'alunoId', 'alunoNome', 'serie', 'prova', 'motivo', 'pago', 'observacoes', 'criadoEm', 'atualizadoEm',
    'turma', 'componente', 'atestado', 'atestadoArquivoUrl', 'atestadoArquivoNome', 'dataRealizacao', 'realizada', 'valor'
  ];

  function spreadsheetId() {
    return PropertiesService.getScriptProperties().getProperty(PROP_ID);
  }

  function isConfigured() { return !!spreadsheetId(); }

  /** Abre a planilha; com criar=true, provisiona uma nova se ainda não existir. */
  function book(criar) {
    var id = spreadsheetId();
    if (id) {
      try { return SpreadsheetApp.openById(id); }
      catch (e) {
        throw new Error('DATA_SPREADSHEET_ID configurado (' + id + ') mas a planilha não pôde ser ' +
          'aberta. Verifique se ela existe e se o usuário do deploy tem acesso. ' + e);
      }
    }
    if (!criar) return null;

    var ss = SpreadsheetApp.create('Provas Substitutivas — Dados');
    PropertiesService.getScriptProperties().setProperty(PROP_ID, ss.getId());
    var padrao = ss.getSheets()[0];
    ensureSheet(ss);
    try { if (padrao && padrao.getName() !== ABA) ss.deleteSheet(padrao); } catch (e) { /* não é fatal */ }
    return ss;
  }

  /** Garante que a aba existe e que o cabeçalho tem TODAS as colunas de COLS. */
  function ensureSheet(ss) {
    var sh = ss.getSheetByName(ABA);
    if (!sh) {
      sh = ss.insertSheet(ABA);
      sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
      sh.setFrozenRows(1);
      return sh;
    }
    // Aba já existe (de uma versão anterior do sistema): completa colunas
    // novas no fim, sem mexer nas que já tinham dado gravado.
    var largura = Math.max(sh.getLastColumn(), 1);
    var atual = sh.getRange(1, 1, 1, largura).getValues()[0]
      .map(function (h) { return String(h || '').trim(); });
    if (atual.length < COLS.length) {
      sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    }
    return sh;
  }

  function cellToValue(campo, v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
    return v == null ? '' : String(v);
  }

  function rowsToObjects(valores) {
    if (!valores || valores.length < 2) return [];
    var header = valores[0].map(function (h) { return String(h || '').trim(); });
    var out = [];
    for (var i = 1; i < valores.length; i++) {
      var linha = valores[i];
      var vazia = true;
      for (var c = 0; c < linha.length; c++) { if (linha[c] !== '' && linha[c] != null) { vazia = false; break; } }
      if (vazia) continue;

      var o = { _row: i + 1 };
      for (var k = 0; k < header.length; k++) {
        var campo = header[k];
        if (COLS.indexOf(campo) < 0) continue;
        o[campo] = cellToValue(campo, linha[k]);
      }
      out.push(o);
    }
    return out;
  }

  function objectToRow(o) {
    return COLS.map(function (c) { return o[c] == null ? '' : o[c]; });
  }

  function comLock(fn) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_TIMEOUT)) {
      throw new Error('Sistema ocupado gravando outra alteração. Tente novamente em alguns segundos.');
    }
    try { return fn(); } finally { lock.releaseLock(); }
  }

  function readRegistros() {
    var ss = book(false);
    if (!ss) return [];
    var sh = ss.getSheetByName(ABA);
    if (!sh || sh.getLastRow() < 2) return [];
    var largura = Math.max(sh.getLastColumn(), COLS.length);
    var valores = sh.getRange(1, 1, sh.getLastRow(), largura).getValues();
    return rowsToObjects(valores);
  }

  /** Monta o objeto completo do registro a partir do payload do formulário. */
  function montarRegistro(dados, existente) {
    var base = existente || {};
    return {
      alunoId: dados.alunoId != null ? dados.alunoId : (base.alunoId || ''),
      alunoNome: dados.alunoNome != null ? dados.alunoNome : base.alunoNome,
      serie: dados.serie != null ? dados.serie : base.serie,
      turma: dados.turma != null ? dados.turma : (base.turma || ''),
      componente: dados.componente != null ? dados.componente : base.componente,
      prova: dados.prova != null ? dados.prova : (base.prova || ''),
      motivo: dados.motivo != null ? dados.motivo : base.motivo,
      pago: dados.pago ? 'SIM' : 'NAO',
      observacoes: dados.observacoes != null ? dados.observacoes : (base.observacoes || ''),
      atestado: dados.atestado ? 'SIM' : 'NAO',
      atestadoArquivoUrl: dados.atestadoArquivoUrl != null ? dados.atestadoArquivoUrl : (base.atestadoArquivoUrl || ''),
      atestadoArquivoNome: dados.atestadoArquivoNome != null ? dados.atestadoArquivoNome : (base.atestadoArquivoNome || ''),
      dataRealizacao: dados.dataRealizacao != null ? dados.dataRealizacao : (base.dataRealizacao || ''),
      realizada: dados.realizada ? 'SIM' : 'NAO',
      valor: dados.valor != null ? dados.valor : (base.valor || '')
    };
  }

  function criarRegistro(dados) {
    return comLock(function () {
      var ss = book(true);
      var sh = ensureSheet(ss);
      var agora = Formatters.nowIso();
      var registro = montarRegistro(dados, null);
      registro.id = Utilities.getUuid();
      registro.criadoEm = agora;
      registro.atualizadoEm = agora;
      sh.getRange(sh.getLastRow() + 1, 1, 1, COLS.length).setValues([objectToRow(registro)]);
      return registro;
    });
  }

  function atualizarRegistro(id, dados) {
    return comLock(function () {
      var ss = book(true);
      var sh = ensureSheet(ss);
      var linha = encontrarLinha(sh, id);
      var largura = Math.max(sh.getLastColumn(), COLS.length);
      var existenteLinha = sh.getRange(linha, 1, 1, largura).getValues()[0];
      var header = sh.getRange(1, 1, 1, largura).getValues()[0].map(function (h) { return String(h || '').trim(); });
      var existente = {};
      header.forEach(function (campo, k) { if (COLS.indexOf(campo) >= 0) existente[campo] = cellToValue(campo, existenteLinha[k]); });

      var atualizado = montarRegistro(dados, existente);
      atualizado.id = id;
      atualizado.criadoEm = existente.criadoEm || Formatters.nowIso();
      atualizado.atualizadoEm = Formatters.nowIso();
      sh.getRange(linha, 1, 1, COLS.length).setValues([objectToRow(atualizado)]);
      return atualizado;
    });
  }

  function excluirRegistro(id) {
    return comLock(function () {
      var ss = book(false);
      if (!ss) throw new Error('Registro não encontrado');
      var sh = ss.getSheetByName(ABA);
      var linha = encontrarLinha(sh, id);
      sh.deleteRow(linha);
      return true;
    });
  }

  function marcarPago(id, pago) {
    return comLock(function () {
      var ss = book(false);
      if (!ss) throw new Error('Registro não encontrado');
      var sh = ss.getSheetByName(ABA);
      var linha = encontrarLinha(sh, id);
      sh.getRange(linha, COLS.indexOf('pago') + 1).setValue(pago ? 'SIM' : 'NAO');
      sh.getRange(linha, COLS.indexOf('atualizadoEm') + 1).setValue(Formatters.nowIso());
      return true;
    });
  }

  function encontrarLinha(sh, id) {
    if (sh.getLastRow() < 2) throw new Error('Registro não encontrado');
    var valores = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < valores.length; i++) {
      if (valores[i][0] === id) return i + 2;
    }
    throw new Error('Registro não encontrado');
  }

  function url() {
    var ss = book(false);
    return ss ? ss.getUrl() : null;
  }

  return {
    COLS: COLS,
    isConfigured: isConfigured,
    url: url,
    readRegistros: readRegistros,
    criarRegistro: criarRegistro,
    atualizarRegistro: atualizarRegistro,
    excluirRegistro: excluirRegistro,
    marcarPago: marcarPago
  };
})();

/**
 * criarPlanilhaDados — EXECUTAR UMA VEZ no editor do Apps Script (opcional).
 * A planilha nasce sozinha na 1ª gravação; isto só serve pra já ter a URL em
 * mãos (e o ID pra configurar o Python) antes de liberar o sistema.
 */
function criarPlanilhaDados() {
  if (SheetStore.isConfigured()) {
    Logger.log('A planilha de dados já existe: ' + SheetStore.url());
    return { ok: true, jaExistia: true, url: SheetStore.url() };
  }
  var ss = SpreadsheetApp.create('Provas Substitutivas — Dados');
  PropertiesService.getScriptProperties().setProperty('DATA_SPREADSHEET_ID', ss.getId());
  var sh = ss.getSheets()[0];
  sh.setName('Registros');
  sh.getRange(1, 1, 1, SheetStore.COLS.length).setValues([SheetStore.COLS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  Logger.log('Planilha de dados criada: ' + ss.getUrl());
  Logger.log('ID (usar no PLANILHA_ID do Python): ' + ss.getId());
  return { ok: true, id: ss.getId(), url: ss.getUrl() };
}

/**
 * atualizarCabecalhoPlanilha — EXECUTAR se a planilha já existia de uma
 * versão anterior (menos colunas). Só acrescenta as colunas novas no fim,
 * não mexe no dado já gravado.
 */
function atualizarCabecalhoPlanilha() {
  if (!SheetStore.isConfigured()) {
    Logger.log('Ainda não existe planilha de dados. Nada a atualizar.');
    return { ok: false };
  }
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('DATA_SPREADSHEET_ID'));
  var sh = ss.getSheetByName('Registros');
  sh.getRange(1, 1, 1, SheetStore.COLS.length).setValues([SheetStore.COLS]).setFontWeight('bold');
  Logger.log('Cabeçalho atualizado (' + SheetStore.COLS.length + ' coluna): ' + SheetStore.COLS.join(', '));
  return { ok: true };
}

/** Mostra no log onde os registros estão sendo gravados. */
function verPlanilha() {
  var u = SheetStore.url();
  if (!u) {
    Logger.log('Ainda não existe planilha de dados. Ela nasce na 1ª gravação, ou rode criarPlanilhaDados().');
    return null;
  }
  Logger.log('Registros estão em: ' + u);
  return u;
}
