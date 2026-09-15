/**
 * Code.gs — Entrada da Web App (HtmlService) e roteador único de API.
 *
 * Arquitetura de chamada:
 *   Frontend  --google.script.run.apiRouter(method,payload)-->  Code.gs
 *   Code.gs   --dispatch-->  Services  -->  Azure SQL (leitura) / Sheets (leitura+escrita)
 *
 * O frontend recebe SEMPRE JSON (string) — simples de serializar.
 */

function doGet() {
  var t = HtmlService.createTemplateFromFile('index');
  t.CURRENT_USER = getCurrentUser();
  try {
    t.BOOT_DATA = jsonParaScriptTag(RegistrosService.getBootstrap());
  } catch (e) {
    // Falhou o pré-carregamento (ex.: Azure fora do ar): a página ainda abre e
    // o frontend refaz a chamada pela API, exibindo o erro de forma amigável.
    console.error('Falha no pré-carregamento: ' + e);
    t.BOOT_DATA = '';
  }
  return t.evaluate()
    .setTitle('Provas Substitutivas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function jsonParaScriptTag(obj) {
  var LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getCurrentUser() {
  try { return Session.getActiveUser().getEmail() || ''; }
  catch (e) { return ''; }
}

/** Operações que um LEITOR pode executar. Tudo fora daqui exige perfil de editor. */
var METODOS_DE_LEITURA = {
  getBootstrap: true
};

function apiRouter(method, payloadJson) {
  var p = {};
  try { p = payloadJson ? JSON.parse(payloadJson) : {}; } catch (e) { p = {}; }

  /* Controle de permissão AQUI, não na interface: esconder botão no navegador
     não protege nada — qualquer um com o console aberto chama apiRouter na
     mão. A recusa precisa acontecer neste ponto, por onde toda operação passa. */
  if (!METODOS_DE_LEITURA[method]) {
    var usuarioAtual = getCurrentUser();
    if (!Config.isEditor(usuarioAtual)) {
      throw new Error('Seu acesso não permite esta ação. Para cadastrar ou alterar registros, ' +
        'peça para incluírem ' + (usuarioAtual || 'seu e-mail') + ' na lista EDITORES do sistema.');
    }
  }

  var handlers = {
    getBootstrap: function () { return RegistrosService.getBootstrap(p.ano); },
    criarRegistro: function () { return RegistrosService.criar(p.dados); },
    atualizarRegistro: function () { return RegistrosService.atualizar(p.id, p.dados); },
    excluirRegistro: function () { return RegistrosService.excluir(p.id); },
    marcarPago: function () { return RegistrosService.marcarPago(p.id, p.pago); }
  };

  if (!handlers[method]) throw new Error('Método desconhecido: ' + method);
  return JSON.stringify(handlers[method]());
}
