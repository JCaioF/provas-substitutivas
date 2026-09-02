/**
 * MockData.gs — Base de demonstração usada quando AZURE_SQL_URL não está
 * configurado (Config.useMock() === true). Permite abrir e testar o sistema
 * inteiro sem depender do Azure.
 */
var MockData = (function () {

  var SERIES = ['1º ANO', '2º ANO', '3º ANO', '4º ANO', '5º ANO', '6º ANO', '7º ANO', '8º ANO', '9º ANO'];
  var NOMES = [
    'Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Alves', 'Elisa Rocha',
    'Felipe Nunes', 'Gabriela Melo', 'Heitor Cunha', 'Isabela Reis', 'João Pedro Faria',
    'Karina Vieira', 'Lucas Barros', 'Marina Costa', 'Nicolas Teixeira', 'Olívia Ramos',
    'Pedro Henrique Sá', 'Rafaela Pinto', 'Samuel Duarte', 'Tainá Moreira', 'Vitor Hugo Castro'
  ];

  /** Linhas no MESMO formato que a query real devolveria (ver Queries.alunosPorAno). */
  function linhasAlunos() {
    var linhas = [];
    var unidade = ['CHACARA', 'MORUMBI'];
    var turmas = ['A', 'B', 'C'];
    NOMES.forEach(function (nome, i) {
      var serie = SERIES[i % SERIES.length];
      var turma = serie + ' ' + turmas[i % turmas.length];
      linhas.push({
        ALUNO_ID: 'MOCK' + (1000 + i),
        NOME_ALUNO: nome,
        SERIE_ID: serie,
        SERIE_NOME: serie,
        TURMA_ID: turma,
        TURMA_NOME: turma,
        UNIDADE: unidade[i % 2]
      });
    });
    return linhas;
  }

  return { linhasAlunos: linhasAlunos };
})();
