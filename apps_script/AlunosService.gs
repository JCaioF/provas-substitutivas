/** AlunosService.gs — Acesso a alunos/séries (via Azure SQL / mock). */
var AlunosService = (function () {

  function anoPadrao() {
    return new Date().getFullYear();
  }

  /** {alunos, series} do ano letivo corrente — usado pra popular o autocomplete. */
  function getReferencia() {
    return AzureSQLService.getReferencia(anoPadrao());
  }

  return { anoPadrao: anoPadrao, getReferencia: getReferencia };
})();
