/** AlunosService.gs — Acesso a alunos/séries (via Azure SQL / mock). */
var AlunosService = (function () {

  function anoPadrao() {
    return new Date().getFullYear();
  }

  /** {alunos, series} do ano letivo — usado pra popular o autocomplete. */
  function getReferencia(ano) {
    return AzureSQLService.getReferencia(Number(ano) || anoPadrao());
  }

  return { anoPadrao: anoPadrao, getReferencia: getReferencia };
})();
