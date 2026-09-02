/** Formatters.gs — Datas/horas no formato do sistema (backend). */
var Formatters = (function () {
  var TZ = 'America/Sao_Paulo';
  function nowIso() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
  return { nowIso: nowIso };
})();
