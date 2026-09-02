/**
 * Queries.gs — Construção de SQL parametrizado. Mesma tabela do gas-deploy
 * (GOLD_REG_DASHBOARD_MAT), aqui só os campos que este sistema usa: aluno,
 * série, unidade.
 *
 * PARÂMETROS, NÃO CONCATENAÇÃO: cada função devolve {sql, params}; o
 * AzureSQL liga os valores via PreparedStatement — nenhum valor do usuário
 * entra no texto do SQL.
 */
var Queries = (function () {

  function alunosPorAno(ano) {
    var idField = Config.alunoIdField();
    var filialField = Config.filialField();

    var sql = [
      'SELECT',
      '  ' + idField + '   AS ALUNO_ID,',
      '  nome_aluno        AS NOME_ALUNO,',
      '  serie             AS SERIE_ID,',
      '  serie             AS SERIE_NOME,',
      '  codturma          AS TURMA_ID,',
      '  turma_nome        AS TURMA_NOME,',
      '  ' + filialField + ' AS UNIDADE',
      'FROM ' + Config.TABELA_ALUNOS,
      'WHERE codperlet = ?',
      '  AND cod_coligada = ?'
    ];
    return { sql: sql.join('\n'), params: [Number(ano) || 0, Config.COLIGADA] };
  }

  function anosDisponiveis() {
    return {
      sql: [
        'SELECT DISTINCT codperlet AS ANO',
        'FROM ' + Config.TABELA_ALUNOS,
        'WHERE cod_coligada = ?',
        'ORDER BY ANO DESC'
      ].join('\n'),
      params: [Config.COLIGADA]
    };
  }

  return { alunosPorAno: alunosPorAno, anosDisponiveis: anosDisponiveis };
})();
