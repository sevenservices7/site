import type { Diagnostico } from './types';

// LP 4 — /diagnostico/nacionalidade (RASCUNHO: publicado=false)
//
// VALIDAÇÃO JURÍDICA PENDENTE — a lei da nacionalidade mudou e as regras ainda vão ser validadas pelo
// advogado parceiro. NENHUM prazo legal fixo no texto. Os critérios abaixo são placeholders: cada regra
// só encaminha para a "via" certa e todas estão marcadas para revisão.
// Placeholders a preencher pelo advogado (NÃO usar no texto público até validar):
export const PRAZOS_NACIONALIDADE = {
  residenciaAnos: '[PRAZO A VALIDAR]', // VALIDAÇÃO JURÍDICA PENDENTE
  casamentoAnos: '[PRAZO A VALIDAR]', // VALIDAÇÃO JURÍDICA PENDENTE
  residenciaPaisFilhoAnos: '[PRAZO A VALIDAR]', // VALIDAÇÃO JURÍDICA PENDENTE
  contagemDesde: '[A VALIDAR: data do 1.º título ou da manifestação de interesse?]', // VALIDAÇÃO JURÍDICA PENDENTE
};

export const nacionalidade: Diagnostico = {
  slug: 'nacionalidade',
  publicado: false,
  nome: 'Nacionalidade portuguesa',
  seo: {
    title: 'Diagnóstico gratuito: nacionalidade portuguesa | SEVEN',
    description: 'Veja por qual via você pode pedir a nacionalidade portuguesa.',
  },
  textos: {
    a: {
      titulo: 'A lei da nacionalidade mudou. Descubra se você ainda tem direito.',
      subtitulo: 'Responda algumas perguntas e veja, de graça, qual via de nacionalidade se aplica ao seu caso.',
      botao: 'Ver se tenho direito',
    },
    b: {
      titulo: 'Neto de português? Você pode ter direito à nacionalidade, e talvez não saiba.',
      subtitulo: 'Um diagnóstico gratuito para entender a sua via de nacionalidade.',
      botao: 'Ver se tenho direito',
    },
  },
  perguntas: [
    {
      id: 'via', texto: 'Qual destas situações descreve melhor o seu caso?',
      opcoes: [
        { valor: 'residencia', texto: 'Moro em Portugal há alguns anos' },
        { valor: 'casamento', texto: 'Sou casado(a) ou vivo em união de facto com cidadão(ã) português(a)' },
        { valor: 'filho_pt', texto: 'Tenho filho nascido em Portugal' },
        { valor: 'descendencia', texto: 'Tenho pai, mãe, avô ou avó portugueses' },
      ],
    },
    // --- Via residência ---
    {
      id: 'primeiro_titulo', texto: 'Em que ano você recebeu o seu primeiro título de residência?',
      showIf: { q: 'via', in: ['residencia', 'filho_pt'] },
      opcoes: [
        { valor: 'ate_2016', texto: 'Até 2016' },
        { valor: '2017_2019', texto: 'Entre 2017 e 2019' },
        { valor: '2020_2022', texto: 'Entre 2020 e 2022' },
        { valor: '2023_mais', texto: '2023 ou depois' },
        { valor: 'nao_tenho', texto: 'Ainda não tenho título' },
      ],
    },
    {
      id: 'tempo_residencia', texto: 'Há quanto tempo, no total, você mora em Portugal?',
      showIf: { q: 'via', in: ['residencia', 'filho_pt'] },
      opcoes: [
        { valor: 'menos_3', texto: 'Menos de 3 anos' },
        { valor: '3_5', texto: 'Entre 3 e 5 anos' },
        { valor: '5_7', texto: 'Entre 5 e 7 anos' },
        { valor: 'mais_7', texto: 'Mais de 7 anos' },
      ],
    },
    // --- Via casamento / união de facto ---
    {
      id: 'tempo_relacao', texto: 'Há quanto tempo dura o casamento ou a união de facto?',
      showIf: { q: 'via', in: ['casamento'] },
      opcoes: [
        { valor: 'menos_2', texto: 'Menos de 2 anos' },
        { valor: '2_5', texto: 'Entre 2 e 5 anos' },
        { valor: 'mais_5', texto: 'Mais de 5 anos' },
      ],
    },
    {
      id: 'relacao_registada', texto: 'O casamento ou a união de facto está registado em Portugal?',
      showIf: { q: 'via', in: ['casamento'] },
      opcoes: [
        { valor: 'sim', texto: 'Sim' },
        { valor: 'nao', texto: 'Ainda não' },
        { valor: 'nao_sei', texto: 'Não sei' },
      ],
    },
    // --- Via filho nascido em Portugal ---
    {
      id: 'filho_registado', texto: 'O nascimento do seu filho está registado em Portugal?',
      showIf: { q: 'via', in: ['filho_pt'] },
      opcoes: [
        { valor: 'sim', texto: 'Sim' },
        { valor: 'nao_sei', texto: 'Não sei' },
      ],
    },
    // --- Via descendência ---
    {
      id: 'parentesco', texto: 'Qual é o seu parentesco com o familiar português?',
      showIf: { q: 'via', in: ['descendencia'] },
      opcoes: [
        { valor: 'pai_mae', texto: 'Pai ou mãe' },
        { valor: 'avo', texto: 'Avô ou avó' },
        { valor: 'bisavo', texto: 'Bisavô ou bisavó' },
      ],
    },
    {
      id: 'documentos_familiar', texto: 'Você tem (ou consegue localizar) a certidão de nascimento portuguesa desse familiar?',
      showIf: { q: 'via', in: ['descendencia'] },
      opcoes: [
        { valor: 'sim', texto: 'Sim' },
        { valor: 'nao', texto: 'Não' },
        { valor: 'nao_sei', texto: 'Não sei por onde começar' },
      ],
    },
  ],
  // VALIDAÇÃO JURÍDICA PENDENTE: todas as regras e cores abaixo.
  regras: [
    {
      id: 'filiacao', prioridade: 100, cor: 'verde', // VALIDAÇÃO JURÍDICA PENDENTE
      quando: { q: 'parentesco', in: ['pai_mae'] },
      servico: 'Nacionalidade portuguesa por filiação',
      descricao: 'Você é filho(a) de português(a). Existe uma via de nacionalidade própria para o seu caso.',
    },
    {
      id: 'netos', prioridade: 90, cor: 'amarelo', // VALIDAÇÃO JURÍDICA PENDENTE
      quando: { q: 'parentesco', in: ['avo'] },
      servico: 'Nacionalidade portuguesa para netos',
      descricao: 'Você é neto(a) de português(a). Existe uma via de nacionalidade para netos, com requisitos próprios que precisam ser analisados no seu caso.',
    },
    {
      id: 'bisnetos', prioridade: 80, cor: 'amarelo', // VALIDAÇÃO JURÍDICA PENDENTE
      quando: { q: 'parentesco', in: ['bisavo'] },
      servico: 'Análise de nacionalidade por descendência',
      descricao: 'O seu familiar português é um bisavô ou bisavó. É preciso analisar a linha familiar para saber se existe uma via aplicável.',
    },
    {
      id: 'casamento', prioridade: 70, cor: 'amarelo', // VALIDAÇÃO JURÍDICA PENDENTE
      quando: { q: 'via', in: ['casamento'] },
      servico: 'Nacionalidade portuguesa por casamento ou união de facto',
      descricao: 'Você é casado(a) ou vive em união de facto com cidadão(ã) português(a). Existe uma via própria para isso, e o tempo da relação e o registo em Portugal fazem diferença.',
    },
    {
      id: 'filho_pt', prioridade: 60, cor: 'amarelo', // VALIDAÇÃO JURÍDICA PENDENTE
      quando: { q: 'via', in: ['filho_pt'] },
      servico: 'Nacionalidade portuguesa (pais de criança nascida em Portugal)',
      descricao: 'Você tem um filho nascido em Portugal. Isso pode abrir uma via de nacionalidade para você, que depende do seu tempo de residência.',
    },
    {
      id: 'residencia', prioridade: 50, cor: 'amarelo', // VALIDAÇÃO JURÍDICA PENDENTE
      quando: { q: 'via', in: ['residencia'] },
      servico: 'Nacionalidade portuguesa por residência',
      descricao: 'Você mora em Portugal. A nacionalidade por residência depende do tempo e da forma como esse tempo é contado, e a lei nova mudou essas regras.',
    },
  ],
  semPerfil: {
    id: 'analise_nacionalidade', cor: 'amarelo',
    servico: 'Análise de nacionalidade',
    descricao: 'Com as suas respostas, é preciso analisar o seu caso com mais detalhe para indicar a via certa.',
  },
  // VALIDAR COM A EQUIPA: pontuação de lead quente/frio.
  temperatura: {
    porCor: { verde: 3, amarelo: 2, vermelho: 3 },
    pontos: [
      { quando: { q: 'documentos_familiar', in: ['sim'] }, pontos: 1 },
      { quando: { q: 'tempo_residencia', in: ['5_7', 'mais_7'] }, pontos: 1 },
    ],
    quenteAPartirDe: 3,
  },
};
