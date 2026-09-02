/**
 * Cache.gs — Cache robusto com suporte a chunking para dados grandes.
 * CacheService tem limite de 100KB por chave; divide JSONs grandes em
 * chunks de 90KB automaticamente.
 */
var Cache = (function () {
  var c = CacheService.getScriptCache();
  var CHUNK_SIZE = 90000;
  var DEFAULT_TTL = 1800;

  function get(key) {
    var meta = c.get(key);
    if (!meta) return null;
    try {
      var m = JSON.parse(meta);
      if (!m._chunked) return m;
      var parts = [];
      for (var i = 0; i < m._chunks; i++) {
        var chunk = c.get(key + '_c' + i);
        if (!chunk) return null;
        parts.push(chunk);
      }
      return JSON.parse(parts.join(''));
    } catch (e) { return null; }
  }

  function put(key, obj, ttl) {
    ttl = ttl || DEFAULT_TTL;
    var json = JSON.stringify(obj);
    if (json.length <= CHUNK_SIZE) {
      try { c.put(key, json, ttl); } catch (e) {}
      return;
    }
    var chunks = [];
    for (var i = 0; i < json.length; i += CHUNK_SIZE) chunks.push(json.substring(i, i + CHUNK_SIZE));
    var batch = {};
    for (var j = 0; j < chunks.length; j++) batch[key + '_c' + j] = chunks[j];
    batch[key] = JSON.stringify({ _chunked: true, _chunks: chunks.length });
    try { c.putAll(batch, ttl); } catch (e) {}
  }

  function remove(key) {
    var meta = c.get(key);
    if (meta) {
      try {
        var m = JSON.parse(meta);
        if (m._chunked) for (var i = 0; i < m._chunks; i++) c.remove(key + '_c' + i);
      } catch (e) {}
    }
    c.remove(key);
  }

  function remember(key, ttl, fn) {
    var hit = get(key); if (hit) return hit;
    var val = fn(); put(key, val, ttl); return val;
  }

  return { get: get, put: put, remove: remove, remember: remember };
})();

/** limparCache — EXECUTAR no editor quando quiser forçar releitura do Azure. */
function limparCache() {
  var atual = new Date().getFullYear();
  Cache.remove('anos_disp');
  for (var ano = atual - 3; ano <= atual + 1; ano++) Cache.remove('ref_' + ano);
  Logger.log('Cache limpo. A próxima leitura vai direto ao Azure.');
  return { ok: true };
}
