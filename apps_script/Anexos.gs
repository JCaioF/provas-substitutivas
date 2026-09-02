/**
 * Anexos.gs — Upload de arquivo (atestado) pro Google Drive.
 * Responsabilidade única: salvar/remover arquivo. SheetStore só guarda a URL.
 */
var Anexos = (function () {

  var PASTA_NOME = 'Provas Substitutivas — Atestados';
  var PROP_PASTA_ID = 'ATESTADOS_FOLDER_ID';
  var TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

  /**
   * Pasta pra guardar atestado. ID gravado em Script Properties (mesmo padrão
   * de SheetStore.PROP_ID) — evita precisar do escopo `drive` inteiro
   * (getFoldersByName varre TODO o Drive do usuário); com `drive.file` já
   * basta, porque só abrimos por ID uma pasta que o próprio app criou.
   */
  function pasta_() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty(PROP_PASTA_ID);
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* pasta sumiu, recria abaixo */ }
    }
    var pasta = DriveApp.createFolder(PASTA_NOME);
    props.setProperty(PROP_PASTA_ID, pasta.getId());
    return pasta;
  }

  /**
   * Salva um arquivo enviado como base64 (data URL sem o prefixo "data:...;base64,").
   * @param {{nome:string, mimeType:string, base64:string}} arquivo
   * @return {{url:string, nome:string}}
   */
  function salvar(arquivo) {
    if (!arquivo || !arquivo.base64) throw new Error('Arquivo vazio.');

    var bytes = Utilities.base64Decode(arquivo.base64);
    if (bytes.length > TAMANHO_MAXIMO) {
      throw new Error('Arquivo maior que 5MB. Envie um arquivo menor.');
    }

    var blob = Utilities.newBlob(bytes, arquivo.mimeType || 'application/octet-stream', arquivo.nome || 'atestado');
    var arquivoDrive = pasta_().createFile(blob);
    arquivoDrive.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { url: arquivoDrive.getUrl(), nome: arquivoDrive.getName() };
  }

  /** Remove o arquivo antigo quando o registro é excluído ou o atestado é substituído. */
  function remover(url) {
    if (!url) return;
    try {
      var id = url.match(/[-\w]{25,}/);
      if (id) DriveApp.getFileById(id[0]).setTrashed(true);
    } catch (e) {
      console.warn('Não foi possível remover o anexo antigo: ' + e);
    }
  }

  return { salvar: salvar, remover: remover };
})();
