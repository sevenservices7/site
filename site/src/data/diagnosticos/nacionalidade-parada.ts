import type { Diagnostico } from './types';

// LP 5 — /diagnostico/nacionalidade-parada (RASCUNHO: publicado=false)
//
// Esta página será publicada EM NOME do advogado parceiro (exigência legal em Portugal).
// PREENCHER antes de publicar (VALIDAÇÃO JURÍDICA PENDENTE):
export const ADVOGADO = {
  nome: '[NOME DO ADVOGADO OU SOCIEDADE]',
  cedula: '[N.º DA CÉDULA PROFISSIONAL]',
};

export const nacionalidadeParada: Diagnostico = {
  slug: 'nacionalidade-parada',
  publicado: false,
  nome: 'Nacionalidade parada',
  seo: {
    title: 'Diagnóstico gratuito: pedido de nacionalidade parado | SEVEN',
    description: 'Veja se o seu pedido de nacionalidade parado pode permitir uma ação para exigir uma decisão.',
  },
  textos: {
    a: {
      titulo: 'Pedido de nacionalidade parado há mais de 2 anos? A lei permite exigir uma decisão.',
      subtitulo: 'Responda 4 perguntas e veja, de graça, se o seu caso pode permitir uma ação.',
      botao: 'Verificar meu pedido',
    },
  },
  perguntas: [
    {
      id: 'data_pedido', texto: 'Quando o seu pedido de nacionalidade deu entrada?',
      opcoes: [
        { valor: 'menos_1', texto: 'Há menos de 1 ano' },
        { valor: '1_2', texto: 'Entre 1 e 2 anos' },
        { valor: 'mais_2', texto: 'Há mais de 2 anos' },
        { valor: 'nao_sei', texto: 'Não sei a data' },
      ],
    },
    {
      // VALIDAÇÃO JURÍDICA PENDENTE: confirmar os nomes das fases como aparecem no site do IRN.
      id: 'fase', texto: 'Em que fase o pedido aparece no site do IRN?',
      opcoes: [
        { valor: 'recebido', texto: 'Pedido recebido / registado' },
        { valor: 'analise', texto: 'Em análise' },
        { valor: 'decisao', texto: 'Aguardando decisão / despacho' },
        { valor: 'nao_sei', texto: 'Não sei / não consigo consultar' },
      ],
    },
    {
      id: 'resposta', texto: 'Já recebeu alguma resposta ou notificação sobre o pedido?',
      opcoes: [
        { valor: 'sim', texto: 'Sim, recebi notificação ou pedido de documentos' },
        { valor: 'nao', texto: 'Não, nenhuma resposta' },
      ],
    },
    {
      id: 'numero_processo', texto: 'Você tem o número do processo?',
      opcoes: [
        { valor: 'sim', texto: 'Sim, tenho' },
        { valor: 'nao', texto: 'Não tenho / não encontro' },
      ],
    },
  ],
  // VALIDAÇÃO JURÍDICA PENDENTE: critério dos 2 anos e efeito de notificações recentes no prazo.
  regras: [
    {
      id: 'acao_decisao', prioridade: 100, cor: 'vermelho',
      quando: { q: 'data_pedido', in: ['mais_2'] },
      titulo: 'Seu caso pode permitir ação',
      servico: 'Ação para exigir decisão do pedido de nacionalidade',
      descricao: 'O seu pedido deu entrada há mais de 2 anos. Nessa situação, pode existir base para exigir uma decisão. O advogado precisa analisar o processo para confirmar.',
    },
    {
      id: 'localizar_processo', prioridade: 50, cor: 'amarelo',
      quando: { any: [{ q: 'data_pedido', in: ['nao_sei'] }, { q: 'numero_processo', in: ['nao'] }] },
      servico: 'Localização e acompanhamento do processo',
      descricao: 'Faltam dados do seu processo (data de entrada ou número). O primeiro passo é localizar o pedido para saber em que ponto ele está.',
    },
  ],
  semPerfil: {
    id: 'acompanhamento', cor: 'amarelo',
    servico: 'Acompanhamento do pedido de nacionalidade',
    descricao: 'O seu pedido deu entrada há menos de 2 anos. Ainda está no período de análise, mas vale acompanhar de perto para agir no momento certo.',
  },
  // VALIDAR COM A EQUIPA: pontuação de lead quente/frio.
  temperatura: {
    porCor: { vermelho: 3, amarelo: 1 },
    pontos: [
      { quando: { q: 'data_pedido', in: ['1_2'] }, pontos: 1 },
      { quando: { q: 'numero_processo', in: ['sim'] }, pontos: 1 },
    ],
    quenteAPartirDe: 3,
  },
  rodapeJuridico: `Serviço jurídico prestado por ${ADVOGADO.nome}, cédula profissional ${ADVOGADO.cedula}, com apoio da SEVEN.`,
};
