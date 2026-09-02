/**
 * Domain.gs — Regras de negócio pequenas e reutilizáveis.
 * Versão enxuta da do projeto gas-deploy: só o que este sistema usa
 * (ordenação pedagógica de série, chave de cruzamento de RA).
 */
var Domain = (function () {

  /**
   * Ordem pedagógica das séries — a ordem que a escola usa é a do percurso do
   * aluno (Educação Infantil -> Fundamental -> Médio), não a alfabética
   * ("10" viria antes de "2").
   */
  function ordemSerie(nome) {
    var s = String(nome == null ? '' : nome).trim().toUpperCase()
      .replace(/[ÁÀÂÃ]/g, 'A').replace(/[ÉÊ]/g, 'E').replace(/[Í]/g, 'I')
      .replace(/[ÓÔÕ]/g, 'O').replace(/[Ú]/g, 'U').replace(/[Ç]/g, 'C');

    var achado = s.match(/\d+/);
    var n = achado ? parseInt(achado[0], 10) : 0;

    if (s.indexOf('GRUPO') >= 0) return 100 + n;   // Educação Infantil
    if (s.indexOf('ANO') >= 0) return 200 + n;     // Fundamental
    if (s.indexOf('SERIE') >= 0) return 300 + n;   // Médio
    if (/^EM\b/.test(s)) return 300 + n;
    return 900;
  }

  function compararSeries(a, b) {
    var oa = ordemSerie(a && a.nome), ob = ordemSerie(b && b.nome);
    if (oa !== ob) return oa - ob;
    return String((a && a.nome) || '').localeCompare(String((b && b.nome) || ''), 'pt-BR');
  }

  /**
   * Chave de cruzamento do RA. O Sheets converte texto numérico em número (o
   * zero à esquerda se perde); esta função devolve uma forma canônica usada
   * dos dois lados (Azure e planilha) para o cruzamento não falhar.
   */
  function chaveAluno(v) {
    var s = String(v == null ? '' : v).trim();
    if (s === '') return '';
    if (/^\d+$/.test(s)) return s.replace(/^0+/, '') || '0';
    return s.toUpperCase();
  }

  return { ordemSerie: ordemSerie, compararSeries: compararSeries, chaveAluno: chaveAluno };
})();
