/**
 * Config.gs — Configuração central e acesso seguro a credenciais.
 *
 * NENHUMA credencial é escrita em código. Segredos ficam no PropertiesService
 * (Script Properties), configurados uma vez pelo administrador (setupCredentials()).
 * O frontend nunca vê nada disto.
 *
 * Mesma base de dado (Azure SQL) do projeto gas-deploy: tabela
 * GOLD_REG_DASHBOARD_MAT, cod_coligada 13, RA em `ra`, unidade em `filial_escola`.
 */
var Config = (function () {

  var COLIGADA = 13;
  var TABELA_ALUNOS = 'GOLD_REG_DASHBOARD_MAT';

  function filialField() {
    return identificador(
      PropertiesService.getScriptProperties().getProperty('FILIAL_FIELD'), 'filial_escola', 'FILIAL_FIELD');
  }

  function alunoIdField() {
    return identificador(
      PropertiesService.getScriptProperties().getProperty('ALUNO_ID_FIELD'), 'ra', 'ALUNO_ID_FIELD');
  }

  /** Nomes de coluna não são parametrizáveis em SQL; restringe ao formato de identificador. */
  function identificador(valor, padrao, nomeDaPropriedade) {
    if (!valor) return padrao;
    var v = String(valor).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) {
      throw new Error('Script Property ' + nomeDaPropriedade + ' inválida: "' + v +
        '". Use apenas o nome da coluna (letras, números e underscore).');
    }
    return v;
  }

  /** Unidade única obrigatória, se configurada. null = todas. */
  function filialFixa() {
    var v = PropertiesService.getScriptProperties().getProperty('FILIAL_FIXA');
    return v ? String(v).trim().toUpperCase() : null;
  }

  /* -------------------------------------------------------------------------
   * MODO MOCK — sem AZURE_SQL_URL configurado, usa MockData pra demonstrar a
   * interface inteira sem banco. Assim que a credencial existir, desliga sozinho.
   * ---------------------------------------------------------------------- */
  var _mockCache = null;
  function useMock() {
    if (_mockCache !== null) return _mockCache;
    _mockCache = PropertiesService.getScriptProperties().getProperty('AZURE_SQL_URL') ? false : true;
    return _mockCache;
  }

  function azureCreds() {
    var p = PropertiesService.getScriptProperties();
    return {
      url: p.getProperty('AZURE_SQL_URL'),
      user: p.getProperty('AZURE_SQL_USER'),
      password: p.getProperty('AZURE_SQL_PASSWORD')
    };
  }

  function dataSpreadsheetId() {
    return PropertiesService.getScriptProperties().getProperty('DATA_SPREADSHEET_ID');
  }

  /* -------------------------------------------------------------------------
   * CACHE
   *   REF_TTL : alunos/séries mudam raramente -> TTL longo (teto do CacheService é 6h).
   * ---------------------------------------------------------------------- */
  var REF_TTL = 21600; // 6h

  /* -------------------------------------------------------------------------
   * PERFIS DE USO
   *   LEITOR (padrão) : abre o sistema, vê a dashboard.
   *   EDITOR          : também cadastra, edita, marca pago, exclui.
   * Quem não está em EDITORES é leitor — ninguém fica trancado de fora, nada é
   * alterado por engano.
   * ---------------------------------------------------------------------- */
  function editorEmails() {
    var raw = PropertiesService.getScriptProperties().getProperty('EDITORES') || '';
    return raw.split(',').map(function (e) { return e.trim().toLowerCase(); })
      .filter(function (e) { return e !== ''; });
  }

  function isEditor(email) {
    if (!email) return false;
    return editorEmails().indexOf(String(email).toLowerCase()) >= 0;
  }

  function perfil(email) {
    return isEditor(email) ? 'editor' : 'leitor';
  }

  return {
    COLIGADA: COLIGADA,
    TABELA_ALUNOS: TABELA_ALUNOS,
    REF_TTL: REF_TTL,
    filialField: filialField,
    alunoIdField: alunoIdField,
    filialFixa: filialFixa,
    useMock: useMock,
    azureCreds: azureCreds,
    dataSpreadsheetId: dataSpreadsheetId,
    editorEmails: editorEmails,
    isEditor: isEditor,
    perfil: perfil
  };
})();

/**
 * setupCredentials — EXECUTAR UMA VEZ pelo administrador no editor do Apps
 * Script. Descomente, preencha, rode, e APAGUE os valores em seguida (nunca
 * commite credenciais reais).
 */
function setupCredentials() {
  // PropertiesService.getScriptProperties().setProperties({
  //   AZURE_SQL_URL: 'jdbc:sqlserver://SEU_HOST:1433;databaseName=SEU_DB',
  //   AZURE_SQL_USER: 'usuario',
  //   AZURE_SQL_PASSWORD: 'senha',
  //
  //   // Opcionais — só se o schema real divergir do padrão:
  //   ALUNO_ID_FIELD: 'ra',
  //   FILIAL_FIELD: 'filial_escola',
  //   // FILIAL_FIXA: 'CHACARA',
  // });
  throw new Error('Descomente e preencha setupCredentials() antes de executar.');
}

/**
 * EDITORES — quem pode cadastrar, editar, excluir e marcar pago.
 * Quem não estiver na lista entra como LEITOR: abre o sistema, só vê.
 */
function setupEditores() {
  var EDITORES = [
    'caio.ferreira@elvirabrandao.com.br'
  ];

  var limpos = EDITORES
    .map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(function (e) { return e !== ''; });

  var invalidos = limpos.filter(function (e) { return !Validation.isEmail(e); });
  if (invalidos.length) {
    throw new Error('E-mail(s) em formato inválido: ' + invalidos.join(', '));
  }
  if (!limpos.length) {
    throw new Error('Preencha a lista EDITORES dentro de setupEditores() antes de executar. ' +
      'Lista vazia deixaria TODO MUNDO como leitor, inclusive você.');
  }

  PropertiesService.getScriptProperties().setProperty('EDITORES', limpos.join(','));
  Logger.log('Editores gravados (' + limpos.length + '): ' + limpos.join(', '));
  Logger.log('Todos os demais usuários entram como leitores.');
  return { ok: true, editores: limpos };
}

/** Mostra no log quem pode editar hoje. */
function listarEditores() {
  var atuais = Config.editorEmails();
  if (!atuais.length) {
    Logger.log('EDITORES está vazio: todo mundo entra como LEITOR. Rode setupEditores() para liberar as pessoas certas.');
  } else {
    Logger.log('Editores (' + atuais.length + '): ' + atuais.join(', '));
  }
  return atuais;
}
