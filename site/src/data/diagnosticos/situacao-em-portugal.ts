import type { Diagnostico } from './types';

// LP 1 — /diagnostico/situacao-em-portugal (PUBLICADA)
// Regras de texto: falar da situação, nunca da pessoa. Sem "ilegal", "deportação", "expulsão".
const TEM_FAMILIAR = ['conjuge', 'filhos', 'outros'];

export const situacaoEmPortugal: Diagnostico = {
  slug: 'situacao-em-portugal',
  publicado: true,
  nome: 'Situação em Portugal',
  seo: {
    title: 'Diagnóstico gratuito: sua situação em Portugal | SEVEN',
    description: 'Responda algumas perguntas e veja quais caminhos se aplicam à sua situação de residência em Portugal.',
  },
  textos: {
    a: {
      titulo: 'Não sabe se está regular em Portugal? Tire a dúvida em 2 minutos.',
      subtitulo: 'Responda algumas perguntas rápidas e veja, de graça, o que se aplica ao seu caso e por onde começar.',
      botao: 'Descobrir minhas opções',
    },
    b: {
      titulo: 'Sua situação em Portugal está travada? Veja quais saídas legais existem para você.',
      subtitulo: 'Um diagnóstico gratuito, em poucos cliques, para entender o seu caso com clareza.',
      botao: 'Descobrir minhas opções',
    },
  },
  perguntas: [
    {
      id: 'chegada', texto: 'Quando você chegou a Portugal?',
      opcoes: [
        { valor: 'menos_1', texto: 'Há menos de 1 ano' },
        { valor: '1_3', texto: 'Entre 1 e 3 anos' },
        { valor: '3_5', texto: 'Entre 3 e 5 anos' },
        { valor: 'mais_5', texto: 'Há mais de 5 anos' },
      ],
    },
    {
      id: 'entrada', texto: 'Como foi a sua entrada em Portugal?',
      opcoes: [
        { valor: 'com_visto', texto: 'Com visto (de trabalho, estudo, procura de trabalho…)' },
        { valor: 'sem_visto', texto: 'Sem visto (como turista)' },
        { valor: 'nao_sei', texto: 'Não sei' },
      ],
    },
    {
      id: 'titulo', texto: 'Você tem título de residência?',
      opcoes: [
        { valor: 'valido', texto: 'Sim, válido' },
        { valor: 'vencido', texto: 'Sim, mas já venceu' },
        { valor: 'em_andamento', texto: 'Tenho um pedido em andamento' },
        { valor: 'nao', texto: 'Ainda não tenho' },
      ],
    },
    {
      id: 'vencimento', texto: 'Quando vence o seu título de residência?',
      showIf: { q: 'titulo', in: ['valido'] },
      opcoes: [
        { valor: 'ate_90', texto: 'Nos próximos 90 dias' },
        { valor: 'mais_90', texto: 'Daqui a mais de 90 dias' },
        { valor: 'nao_sei', texto: 'Não sei' },
      ],
    },
    {
      id: 'tempo_residencia', texto: 'Há quanto tempo você tem residência em Portugal?',
      showIf: { q: 'titulo', in: ['valido', 'vencido'] },
      opcoes: [
        { valor: 'menos_1', texto: 'Menos de 1 ano' },
        { valor: '1_3', texto: 'Entre 1 e 3 anos' },
        { valor: '3_5', texto: 'Entre 3 e 5 anos' },
        { valor: '5_mais', texto: '5 anos ou mais' },
      ],
    },
    {
      id: 'nif_niss', texto: 'Você já tem NIF e NISS?',
      opcoes: [
        { valor: 'ambos', texto: 'Tenho os dois' },
        { valor: 'so_nif', texto: 'Só o NIF' },
        { valor: 'nenhum', texto: 'Ainda não tenho nenhum' },
      ],
    },
    {
      id: 'trabalho', texto: 'Você trabalha em Portugal?',
      opcoes: [
        { valor: 'contrato', texto: 'Sim, com contrato de trabalho' },
        { valor: 'recibos', texto: 'Sim, a recibos verdes' },
        { valor: 'nao', texto: 'Não trabalho em Portugal' },
      ],
    },
    {
      id: 'familiar', texto: 'Tem algum familiar fora de Portugal que gostaria de trazer?',
      opcoes: [
        { valor: 'conjuge', texto: 'Sim, cônjuge ou companheiro(a)' },
        { valor: 'filhos', texto: 'Sim, filhos' },
        { valor: 'outros', texto: 'Sim, pais ou outros familiares' },
        { valor: 'nao', texto: 'Não' },
      ],
    },
    {
      id: 'agendamento_aima', texto: 'Você já tem agendamento na AIMA?',
      showIf: { all: [{ q: 'entrada', in: ['com_visto'] }, { q: 'titulo', in: ['nao', 'em_andamento'] }] },
      opcoes: [
        { valor: 'sim', texto: 'Sim, já tenho data' },
        { valor: 'nao', texto: 'Ainda não consegui agendar' },
      ],
    },
  ],
  // Roteamento do resultado (brief). Se várias se aplicam, a de maior prioridade é a principal
  // e as outras aparecem como "Também se aplica".
  regras: [
    {
      // VALIDAR COM A EQUIPA: hoje vale "entrou sem visto" + sem título nem pedido em andamento.
      id: 'regresso_reentrada', prioridade: 100, cor: 'vermelho',
      quando: { all: [{ q: 'entrada', in: ['sem_visto'] }, { q: 'titulo', in: ['nao'] }] },
      servico: 'Plano de Regresso e Reentrada Legal',
      descricao: 'Pelas suas respostas, a sua entrada foi sem visto e a residência ainda não está formalizada. Existem caminhos legais para organizar esta situação, e a escolha do caminho certo depende do seu histórico.',
    },
    {
      // VALIDAR COM A EQUIPA: título já vencido (não estava no brief) tratado como prioritário.
      id: 'renovacao_vencida', prioridade: 95, cor: 'vermelho',
      quando: { q: 'titulo', in: ['vencido'] },
      servico: 'Renovação de residência',
      descricao: 'O seu título de residência já venceu. A renovação continua sendo o caminho, mas é um ponto que pede atenção imediata para não complicar o seu processo.',
    },
    {
      id: 'renovacao', prioridade: 90, cor: 'amarelo',
      quando: { q: 'vencimento', in: ['ate_90'] },
      servico: 'Renovação de residência',
      descricao: 'O seu título de residência vence nos próximos 90 dias. É o momento de preparar a renovação com antecedência.',
    },
    {
      id: 'agendamento_aima', prioridade: 80, cor: 'amarelo',
      quando: { q: 'agendamento_aima', in: ['nao'] },
      servico: 'Agendamento AIMA + acompanhamento',
      descricao: 'Você entrou com visto, mas ainda não tem agendamento na AIMA para o título de residência. Este é o passo que falta para formalizar a sua residência.',
    },
    {
      id: 'reagrupamento_atencao', prioridade: 60, cor: 'amarelo',
      quando: { all: [{ q: 'familiar', in: TEM_FAMILIAR }, { q: 'titulo', notIn: ['valido'] }] },
      servico: 'Reagrupamento familiar',
      descricao: 'Você quer trazer um familiar para Portugal. O reagrupamento familiar depende da sua própria residência estar em ordem, por isso há pontos a resolver antes.',
    },
    {
      id: 'reagrupamento', prioridade: 50, cor: 'verde',
      quando: { all: [{ q: 'familiar', in: TEM_FAMILIAR }, { q: 'titulo', in: ['valido'] }] },
      servico: 'Reagrupamento familiar',
      descricao: 'Você tem residência válida e um familiar que gostaria de trazer. O reagrupamento familiar é o caminho previsto para isso.',
    },
    {
      id: 'longa_duracao', prioridade: 40, cor: 'verde',
      quando: { q: 'tempo_residencia', in: ['5_mais'] },
      servico: 'Residência de longa duração + Nacionalidade',
      descricao: 'Com 5 anos ou mais de residência, você pode estar perto de uma residência mais estável e de pedir a nacionalidade portuguesa.',
    },
    {
      id: 'nif_niss', prioridade: 10, cor: 'verde',
      quando: { q: 'nif_niss', in: ['so_nif', 'nenhum'] },
      servico: 'NIF e NISS',
      descricao: 'Ainda falta algum dos seus números fiscais ou de Segurança Social, que são a base para quase todos os processos em Portugal.',
    },
  ],
  semPerfil: {
    id: 'analise_geral', cor: 'amarelo',
    servico: 'Análise completa da sua situação',
    descricao: 'As suas respostas não apontam para um único caminho. Um especialista precisa olhar o seu caso com mais detalhe para indicar o próximo passo.',
  },
  // VALIDAR COM A EQUIPA: pontuação de lead quente/frio.
  temperatura: {
    porCor: { vermelho: 3, amarelo: 2, verde: 1 },
    pontos: [
      { quando: { q: 'vencimento', in: ['ate_90'] }, pontos: 1 },
      { quando: { q: 'trabalho', in: ['contrato', 'recibos'] }, pontos: 1 },
      { quando: { q: 'familiar', in: TEM_FAMILIAR }, pontos: 1 },
    ],
    quenteAPartirDe: 3,
  },
};
