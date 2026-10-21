import type { Diagnostico } from './types';

// LP 3 — /diagnostico/visto (PUBLICADA)
//
// VALIDAR COM A EQUIPA — todos os critérios abaixo (faixas de renda mínimas para D7/D8, exigência de
// formação/proposta para D3, etc.) são aproximações para encaminhar o lead, não requisitos legais.
// Os valores de referência mudam com o salário mínimo nacional: rever as faixas todos os anos.
const RENDA_D8_OK = ['2000_3500', '3500_mais']; // VALIDAR COM A EQUIPA
const RENDA_D7_OK = ['1000_2000', '2000_3500', '3500_mais']; // VALIDAR COM A EQUIPA

export const visto: Diagnostico = {
  slug: 'visto',
  publicado: true,
  nome: 'Visto para Portugal',
  seo: {
    title: 'Diagnóstico gratuito: qual visto combina com você | SEVEN',
    description: 'Descubra em 3 minutos qual visto para Portugal combina com o seu perfil.',
  },
  textos: {
    a: {
      titulo: 'Quer morar em Portugal? Descubra em 3 minutos qual visto combina com o seu perfil.',
      subtitulo: 'Responda 8 perguntas rápidas e veja, de graça, o caminho mais provável para o seu caso.',
      botao: 'Descobrir meu visto',
    },
  },
  perguntas: [
    {
      id: 'objetivo', texto: 'Qual é o seu principal objetivo em Portugal?',
      opcoes: [
        { valor: 'remoto', texto: 'Trabalhar remoto' },
        { valor: 'renda_passiva', texto: 'Aposentadoria ou renda passiva' },
        { valor: 'emprego', texto: 'Emprego qualificado' },
        { valor: 'estudar', texto: 'Estudar' },
        { valor: 'familia', texto: 'Juntar-me à família que já mora em Portugal' },
        { valor: 'empreender', texto: 'Empreender' },
      ],
    },
    {
      id: 'tipo_renda', texto: 'Qual é a sua principal fonte de renda hoje?',
      opcoes: [
        { valor: 'remoto_exterior', texto: 'Trabalho remoto para empresa fora de Portugal' },
        { valor: 'freelancer', texto: 'Freelancer / PJ com clientes fora de Portugal' },
        { valor: 'clt_brasil', texto: 'Emprego presencial no Brasil' },
        { valor: 'aposentadoria', texto: 'Aposentadoria ou pensão' },
        { valor: 'investimentos', texto: 'Aluguéis, dividendos ou investimentos' },
        { valor: 'sem_renda', texto: 'Ainda não tenho renda fixa' },
      ],
    },
    {
      id: 'faixa_renda', texto: 'Qual é a sua renda mensal aproximada?',
      ajuda: 'Valor líquido, somando todas as fontes.',
      opcoes: [
        { valor: 'ate_1000', texto: 'Até € 1.000' },
        { valor: '1000_2000', texto: 'Entre € 1.000 e € 2.000' },
        { valor: '2000_3500', texto: 'Entre € 2.000 e € 3.500' },
        { valor: '3500_mais', texto: 'Mais de € 3.500' },
      ],
    },
    {
      id: 'formacao', texto: 'Você tem formação superior?',
      opcoes: [
        { valor: 'sim', texto: 'Sim, tenho diploma' },
        { valor: 'cursando', texto: 'Estou cursando' },
        { valor: 'nao', texto: 'Não' },
      ],
    },
    {
      id: 'proposta', texto: 'Você tem proposta de emprego em Portugal?',
      opcoes: [
        { valor: 'sim', texto: 'Sim, já tenho proposta' },
        { valor: 'em_processo', texto: 'Estou em processo seletivo' },
        { valor: 'nao', texto: 'Não' },
      ],
    },
    {
      id: 'quem_vai', texto: 'Quem vai com você?',
      opcoes: [
        { valor: 'sozinho', texto: 'Vou sozinho(a)' },
        { valor: 'conjuge', texto: 'Cônjuge ou companheiro(a)' },
        { valor: 'conjuge_filhos', texto: 'Cônjuge e filhos' },
        { valor: 'outros', texto: 'Outros familiares' },
      ],
    },
    {
      id: 'prazo', texto: 'Em quanto tempo você quer se mudar?',
      opcoes: [
        { valor: 'ate_3m', texto: 'Nos próximos 3 meses' },
        { valor: '3_6m', texto: 'Entre 3 e 6 meses' },
        { valor: '6_12m', texto: 'Entre 6 meses e 1 ano' },
        { valor: 'mais_12m', texto: 'Mais de 1 ano / ainda sem data' },
      ],
    },
    {
      id: 'patrimonio', texto: 'Você tem empresa ou patrimônio para investir em Portugal?',
      opcoes: [
        { valor: 'empresa', texto: 'Tenho empresa' },
        { valor: 'patrimonio', texto: 'Tenho patrimônio relevante para investir' },
        { valor: 'ambos', texto: 'Tenho os dois' },
        { valor: 'nao', texto: 'Não' },
      ],
    },
  ],
  // Empresa ou patrimônio relevante → high_ticket + "Relocation empresarial" (brief).
  highTicket: { q: 'patrimonio', in: ['empresa', 'patrimonio', 'ambos'] },
  regras: [
    {
      id: 'relocation', prioridade: 100, cor: 'verde',
      quando: { q: 'patrimonio', in: ['empresa', 'patrimonio', 'ambos'] },
      servico: 'Relocation empresarial',
      descricao: 'Você tem empresa ou patrimônio para investir. Isso abre caminhos próprios para a mudança, que pedem um planejamento conjunto do visto, da empresa e da parte fiscal.',
    },
    {
      id: 'reagrupamento', prioridade: 90, cor: 'verde',
      quando: { q: 'objetivo', in: ['familia'] },
      servico: 'Reagrupamento familiar',
      descricao: 'Você quer se juntar à família que já mora em Portugal. O reagrupamento familiar é o caminho previsto para isso, a partir da residência do seu familiar.',
    },
    {
      // VALIDAR COM A EQUIPA: D3 = proposta + formação superior.
      id: 'd3', prioridade: 80, cor: 'verde',
      quando: { all: [{ q: 'proposta', in: ['sim'] }, { q: 'formacao', in: ['sim'] }] },
      servico: 'Visto D3 (atividade altamente qualificada)',
      descricao: 'Você tem formação superior e proposta de emprego em Portugal. O seu perfil combina com o visto para atividade altamente qualificada (D3).',
    },
    {
      id: 'd3_atencao', prioridade: 70, cor: 'amarelo',
      quando: { all: [{ q: 'objetivo', in: ['emprego'] }, { q: 'formacao', in: ['sim', 'cursando'] }, { q: 'proposta', in: ['em_processo', 'nao'] }] },
      servico: 'Visto D3 (atividade altamente qualificada)',
      descricao: 'O seu objetivo é um emprego qualificado, mas ainda falta a proposta de trabalho. O visto D3 depende dela, por isso há pontos a preparar.',
    },
    {
      id: 'd8', prioridade: 60, cor: 'verde',
      quando: { all: [{ q: 'tipo_renda', in: ['remoto_exterior', 'freelancer'] }, { q: 'faixa_renda', in: RENDA_D8_OK }] },
      servico: 'Visto D8 (nômade digital)',
      descricao: 'Você trabalha remoto para fora de Portugal com uma renda compatível. O seu perfil combina com o visto de nômade digital (D8).',
    },
    {
      id: 'd8_atencao', prioridade: 55, cor: 'amarelo',
      quando: { all: [{ q: 'tipo_renda', in: ['remoto_exterior', 'freelancer'] }, { q: 'faixa_renda', notIn: RENDA_D8_OK }] },
      servico: 'Visto D8 (nômade digital)',
      descricao: 'Você trabalha remoto para fora de Portugal, mas a renda informada pode ficar perto do limite exigido. É um ponto a analisar antes do pedido.',
    },
    {
      id: 'd7', prioridade: 50, cor: 'verde',
      quando: { all: [{ q: 'tipo_renda', in: ['aposentadoria', 'investimentos'] }, { q: 'faixa_renda', in: RENDA_D7_OK }] },
      servico: 'Visto D7 (rendimentos próprios)',
      descricao: 'Você tem aposentadoria ou renda passiva. O seu perfil combina com o visto de rendimentos próprios (D7).',
    },
    {
      id: 'd7_atencao', prioridade: 45, cor: 'amarelo',
      quando: { all: [{ q: 'tipo_renda', in: ['aposentadoria', 'investimentos'] }, { q: 'faixa_renda', notIn: RENDA_D7_OK }] },
      servico: 'Visto D7 (rendimentos próprios)',
      descricao: 'Você tem renda passiva, mas o valor informado pode ficar perto do mínimo exigido. É um ponto a analisar antes do pedido.',
    },
    {
      id: 'd4', prioridade: 40, cor: 'verde',
      quando: { q: 'objetivo', in: ['estudar'] },
      servico: 'Visto D4 (estudo)',
      descricao: 'O seu objetivo é estudar em Portugal. O caminho é o visto de estudo (D4), a partir da matrícula numa instituição de ensino.',
    },
  ],
  semPerfil: {
    id: 'sem_perfil', cor: 'amarelo',
    titulo: 'Ainda não há um caminho claro',
    servico: 'Conteúdo e acompanhamento',
    descricao: 'Com as respostas de hoje, nenhum visto se encaixa com clareza no seu perfil. Isso pode mudar com a sua renda, uma proposta de trabalho ou um plano de estudo, e vamos enviar conteúdo para ajudar você a se preparar.',
    temperatura: 'frio', // vai para nutrição
  },
  // VALIDAR COM A EQUIPA: pontuação de lead quente/frio. High ticket é sempre quente.
  temperatura: {
    porCor: { verde: 2, amarelo: 1 },
    pontos: [
      { quando: { q: 'prazo', in: ['ate_3m'] }, pontos: 2 },
      { quando: { q: 'prazo', in: ['3_6m'] }, pontos: 1 },
      { quando: { q: 'faixa_renda', in: ['3500_mais'] }, pontos: 1 },
      { quando: { q: 'quem_vai', in: ['conjuge', 'conjuge_filhos', 'outros'] }, pontos: 1 },
    ],
    quenteAPartirDe: 3,
  },
};
