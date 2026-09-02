/** Validation.gs — Validações genéricas reutilizáveis (backend). */
var Validation = (function () {
  function required(v) { return v != null && String(v).trim() !== ''; }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')); }
  return { required: required, isEmail: isEmail };
})();
