import type { Diagnostico } from './types';

// LP 2 — /diagnostico/carta-de-conducao (PUBLICADA)
//
// VALIDAR COM A EQUIPA — regras específicas da troca de carta. Não inventamos requisitos legais:
// o diagnóstico só identifica a situação e o serviço. Confirmar com a equipa antes de mexer nas regras:
//  - prazos para pedir a troca depois de obter residência (e se mudam por país emissor);
//  - se a carta precisa estar válida no momento do pedido e o que fazer com carta vencida;
//  - categorias aceites na troca (A, B, profissionais) e exames/atestados exigidos;
//  - documento de residência aceite (título, certificado de registo de cidadão da UE, pedido em andamento).
const RESIDE = ['titulo', 'cidadao_ue', 'em_andamento'];

export const cartaDeConducao: Diagnostico = {
  slug: 'carta-de-conducao',
  publicado: true,
  nome: 'Carta de condução',
  seo: {
    title: 'Diagnóstico gratuito: troca de carta de condução | SEVEN',
    description: 'Veja em poucos cliques se a sua carta brasileira pode ser trocada em Portugal e qual serviço se aplica.',
  },
  textos: {
    a: {
      titulo: 'Mora em Portugal com carta brasileira? Veja se pode trocar a sua carta.',
      subtitulo: 'Responda 6 perguntas rápidas e descubra, de graça, qual é a situação da sua carta em Portugal.',
      botao: 'Ver meu caso',
    },
    b: {
      titulo: 'Tem cidadania europeia e carta brasileira? Veja o que fazer com a sua carta em Portugal.',
      subtitulo: 'Um diagnóstico gratuito para entender o que se aplica à sua carta.',
      botao: 'Ver meu caso',
    },
  },
  perguntas: [
    {
      id: 'nacionalidade', texto: 'Qual é a sua nacionalidade?',
      opcoes: [
        { valor: 'brasileira', texto: 'Brasileira' },
        { valor: 'europeia', texto: 'De um país da União Europeia' },
        { valor: 'dupla', texto: 'Dupla: brasileira e europeia' },
        { valor: 'outra', texto: 'Outra' },
      ],
    },
    {
      id: 'pais_carta', texto: 'Qual país emitiu a sua carta de condução?',
      opcoes: [
        { valor: 'brasil', texto: 'Brasil' },
        { valor: 'ue', texto: 'Um país da União Europeia' },
        { valor: 'outro', texto: 'Outro país' },
      ],
    },
    {
      id: 'residencia', texto: 'Você mora em Portugal? Com qual documento?',
      opcoes: [
        { valor: 'titulo', texto: 'Sim, com título de residência' },
        { valor: 'cidadao_ue', texto: 'Sim, com documento de cidadão europeu' },
        { valor: 'em_andamento', texto: 'Sim, com pedido de residência em andamento' },
        { valor: 'nao', texto: 'Ainda não moro em Portugal' },
      ],
    },
    {
      id: 'tempo', texto: 'Há quanto tempo você mora em Portugal?',
      showIf: { q: 'residencia', notIn: ['nao'] },
      opcoes: [
        { valor: 'menos_6m', texto: 'Menos de 6 meses' },
        { valor: '6m_2a', texto: 'Entre 6 meses e 2 anos' },
        { valor: 'mais_2a', texto: 'Mais de 2 anos' },
      ],
    },
    {
      id: 'validade', texto: 'A sua carta está dentro da validade?',
      opcoes: [
        { valor: 'valida', texto: 'Sim, está válida' },
        { valor: 'vencida', texto: 'Não, está vencida' },
        { valor: 'nao_sei', texto: 'Não sei' },
      ],
    },
    {
      id: 'categoria', texto: 'Qual é a categoria da sua carta?',
      opcoes: [
        { valor: 'b', texto: 'Carro (B)' },
        { valor: 'a', texto: 'Moto (A)' },
        { valor: 'ab', texto: 'Carro e moto (AB)' },
        { valor: 'profissional', texto: 'Profissional (C, D ou E)' },
      ],
    },
  ],
  regras: [
    {
      // VALIDAR COM A EQUIPA: o que fazer com carta vencida (renovar no país emissor antes? outro caminho?).
      id: 'carta_vencida', prioridade: 100, cor: 'vermelho',
      quando: { all: [{ q: 'validade', in: ['vencida'] }, { q: 'pais_carta', notIn: ['ue'] }] },
      servico: 'Troca de carta de condução (análise de carta vencida)',
      descricao: 'A sua carta está vencida. Isso muda o caminho para conduzir em Portugal e precisa ser analisado antes de qualquer pedido.',
    },
    {
      id: 'carta_ue', prioridade: 90, cor: 'verde',
      quando: { q: 'pais_carta', in: ['ue'] },
      titulo: 'Sua carta já é reconhecida em Portugal',
      servico: 'IRS em Portugal e renovação de residência',
      descricao: 'Cartas emitidas num país da União Europeia já são reconhecidas em Portugal. Enquanto isso, vale a pena olhar outras obrigações, como o IRS e a sua residência.',
      temperatura: 'frio',
    },
    {
      id: 'troca_imt', prioridade: 80, cor: 'amarelo',
      quando: { all: [{ q: 'pais_carta', notIn: ['ue'] }, { q: 'residencia', in: RESIDE }] },
      servico: 'Troca de carta via IMT',
      descricao: 'Você mora em Portugal com uma carta emitida fora da União Europeia. O caminho é o pedido de troca no IMT, que tem prazos e documentos próprios.',
    },
    {
      id: 'carta_validade_incerta', prioridade: 20, cor: 'amarelo',
      quando: { q: 'validade', in: ['nao_sei'] },
      servico: 'Verificação da carta',
      descricao: 'Não está claro se a sua carta está válida, e isso influencia o pedido de troca.',
    },
  ],
  semPerfil: {
    id: 'planeamento_carta', cor: 'amarelo',
    servico: 'Planeamento da troca de carta',
    descricao: 'Você ainda não mora em Portugal. A troca da carta é feita depois da residência, e vale a pena planejar desde já para não ficar sem conduzir.',
  },
  // VALIDAR COM A EQUIPA: pontuação de lead quente/frio.
  temperatura: {
    porCor: { vermelho: 3, amarelo: 2, verde: 0 },
    pontos: [
      { quando: { q: 'categoria', in: ['profissional'] }, pontos: 1 },
      { quando: { q: 'residencia', in: ['nao'] }, pontos: -2 },
    ],
    quenteAPartirDe: 2,
  },
};
