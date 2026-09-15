/** RegistrosService.gs — Regras de negócio dos registros de prova substitutiva. */
var RegistrosService = (function () {

  var COMPONENTES = [
    'Português', 'Matemática', 'Ciências', 'H/G', 'Inglês',
    'Science', 'Maths', 'ELA', 'Soc. Studies'
  ];

  function listar() {
    return SheetStore.readRegistros().map(function (r) {
      return {
        id: r.id,
        alunoId: r.alunoId,
        alunoNome: r.alunoNome,
        serie: r.serie,
        turma: r.turma,
        componente: r.componente,
        prova: r.prova,
        motivo: r.motivo,
        pago: r.pago === 'SIM',
        observacoes: r.observacoes,
        atestado: r.atestado === 'SIM',
        atestadoArquivoUrl: r.atestadoArquivoUrl,
        atestadoArquivoNome: r.atestadoArquivoNome,
        dataRealizacao: r.dataRealizacao,
        realizada: r.realizada === 'SIM',
        valor: r.valor === '' || r.valor == null ? null : Number(r.valor),
        criadoEm: r.criadoEm
      };
    });
  }

  function validar(dados) {
    if (!dados || !Validation.required(dados.alunoNome) || !Validation.required(dados.componente) ||
        !Validation.required(dados.motivo)) {
      throw new Error('Preencha aluno, componente e motivo.');
    }
  }

  /**
   * Se vier um arquivo novo no payload (dados.arquivoAtestado), sobe pro
   * Drive e troca pela URL antes de gravar na planilha — a planilha nunca
   * guarda o base64, só o link.
   */
  function processarAnexo(dados, registroAnterior) {
    if (dados.arquivoAtestado && dados.arquivoAtestado.base64) {
      if (registroAnterior && registroAnterior.atestadoArquivoUrl) {
        Anexos.remover(registroAnterior.atestadoArquivoUrl);
      }
      var salvo = Anexos.salvar(dados.arquivoAtestado);
      dados.atestadoArquivoUrl = salvo.url;
      dados.atestadoArquivoNome = salvo.nome;
    }
    delete dados.arquivoAtestado;
    return dados;
  }

  function criar(dados) {
    validar(dados);
    processarAnexo(dados, null);
    return SheetStore.criarRegistro(dados);
  }

  function atualizar(id, dados) {
    validar(dados);
    var anterior = SheetStore.readRegistros().filter(function (r) { return r.id === id; })[0];
    processarAnexo(dados, anterior);
    return SheetStore.atualizarRegistro(id, dados);
  }

  function excluir(id) {
    var anterior = SheetStore.readRegistros().filter(function (r) { return r.id === id; })[0];
    if (anterior && anterior.atestadoArquivoUrl) Anexos.remover(anterior.atestadoArquivoUrl);
    return SheetStore.excluirRegistro(id);
  }

  function marcarPago(id, pago) {
    return SheetStore.marcarPago(id, !!pago);
  }

  /**
   * Tudo que a tela precisa pra abrir, numa chamada só (evita round-trips
   * extras no cold start). `ano` troca de qual ano letivo o Azure puxa a
   * lista de aluno (pro autocomplete) — os registros em si não têm ano
   * gravado, a tela filtra por ano/semestre na hora olhando a data.
   */
  function getBootstrap(ano) {
    ano = Number(ano) || AlunosService.anoPadrao();
    var ref = AlunosService.getReferencia(ano);
    return {
      perfil: Config.perfil(getCurrentUser()),
      modo: Config.useMock() ? 'mock' : 'azure',
      ano: ano,
      anosDisponiveis: AzureSQLService.getAnos(),
      alunos: ref.alunos,
      series: ref.series,
      componentes: COMPONENTES,
      registros: listar()
    };
  }

  return {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    excluir: excluir,
    marcarPago: marcarPago,
    getBootstrap: getBootstrap
  };
})();
