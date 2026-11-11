import type { Solution } from '../solution-types';

// Valores e condições: os mesmos publicados em dfaro.pt/morada-fiscal (D'Faro Business Center,
// o prédio da unidade SEVEN de Faro). Se mudarem lá, atualizar aqui e nas traduções.
export const solution: Solution = {
  slug: "morada-fiscal-para-empresas",
  stage: "empresa",
  navLabel: "Morada fiscal e sede",
  cardSummary: "Sede e morada fiscal para a sua empresa no centro de Faro, sem alugar escritório, desde 49 € + IVA por mês.",
  seoTitle: "Morada fiscal e sede para empresa em Portugal | SEVEN",
  metaDescription: "Morada fiscal e sede social para empresa em Portugal, no centro de Faro. Declaração de sede em 1 dia útil, tudo à distância, desde 49 € + IVA por mês.",
  eyebrow: "Empresas · Faro",
  h1: "Morada fiscal e sede para a sua empresa, sem alugar escritório",
  lede: "Toda empresa em Portugal precisa de uma sede. A sua pode ficar no centro de Faro, com a correspondência tratada e a declaração de sede pronta em 1 dia útil.",
  highlights: [
    { value: "Desde 49 €", label: "+ IVA por mês, em contrato anual" },
    { value: "1 dia útil", label: "para receber a declaração de sede" },
    { value: "100% à distância", label: "com assinatura eletrônica" },
    { value: "Centro de Faro", label: "morada real, com recepção" },
  ],
  forWhoTitle: "A sede da empresa é pública. O endereço da sua casa não precisa ser.",
  forWho: [
    {
      title: "Quem vai abrir empresa",
      body: "A sede aparece no registro comercial, nas faturas e no site. Com a morada em Faro, o endereço da sua casa fica fora disso, e você não aluga escritório antes de faturar.",
    },
    {
      title: "Quem já tem empresa",
      body: "A sede está na casa de um sócio e as cartas se perdem pelo caminho. Dá para mudar para uma morada comercial estável e ter a correspondência em ordem.",
    },
    {
      title: "Sócio que mora fora de Portugal",
      body: "Você está no Brasil ou em outro país e a empresa precisa de um endereço português. Basta ter NIF português, e tudo é feito à distância.",
    },
    {
      title: "Quem trabalha de casa ou online",
      body: "Consultoria, loja online, prestação de serviços. O negócio não precisa de porta aberta, mas a empresa precisa de uma morada.",
    },
  ],
  dictionary: [
    { term: "Morada fiscal", meaning: "o endereço fiscal, aquele que fica registrado nas Finanças" },
    { term: "Sede social", meaning: "o endereço oficial da empresa, que consta no contrato social e no registro comercial" },
    { term: "Declaração de sede", meaning: "o documento que autoriza a empresa a usar a morada, pedido na hora do registro" },
    { term: "Conservatória do Registo Comercial", meaning: "o órgão que registra as empresas, como a Junta Comercial no Brasil" },
  ],
  includedTitle: "Um endereço que trabalha por você.",
  included: [
    {
      title: "Sede social e domicílio fiscal",
      body: "A mesma morada serve para o registro comercial e para as Finanças. É uma morada real, no centro de Faro, com recepção.",
    },
    {
      title: "Declaração de sede em 1 dia útil",
      body: "Com os documentos completos e o primeiro pagamento, sai a declaração que autoriza o uso da morada, exigida no registro da empresa.",
    },
    {
      title: "Correspondência recebida e avisada",
      body: "Chegou carta, você recebe um aviso por e-mail em 1 dia útil. A correspondência fica guardada por 90 dias.",
    },
    {
      title: "Cartas digitalizadas",
      body: "Nos planos Business e Executive, a carta é digitalizada e enviada para o seu e-mail. Você lê de onde estiver.",
    },
    {
      title: "Contratação à distância",
      body: "O contrato é assinado de forma eletrônica e o pagamento é feito por transferência. Sem deslocação e sem caução.",
    },
    {
      title: "Mudança de sede",
      body: "Se a empresa já existe, a gente cuida da alteração da sede no registro comercial e nas Finanças. É um serviço à parte, orçado antes de começar.",
    },
  ],
  stepsTitle: "Como contratar a morada fiscal",
  steps: [
    {
      title: "Fale com a gente",
      body: "Você escolhe o plano e envia o documento de identificação, cartão de cidadão ou passaporte, e o NIF português.",
    },
    {
      title: "Assine à distância",
      body: "O contrato é assinado de forma eletrônica e o primeiro pagamento é feito por transferência.",
    },
    {
      title: "Receba a declaração de sede",
      body: "Em 1 dia útil, com documentos completos e pagamento feito, você recebe a declaração para usar no registro.",
    },
    {
      title: "Registre ou altere a sede",
      body: "Com a declaração, a sede é registrada na Conservatória e nas Finanças. Se você preferir, a gente faz essa parte.",
    },
  ],
  important: {
    title: "A morada é da empresa, não da pessoa",
    body: "Essa morada serve só para uso empresarial. Ela não vale como endereço pessoal, por exemplo para tirar o seu NIF, pedir residência ou receber cartas em seu nome. Para a sua morada fiscal pessoal o caminho é outro, e a gente explica qual.",
  },
  faqs: [
    {
      q: "Posso usar a morada como sede da minha empresa em Portugal?",
      a: "Pode. Ela serve como sede social e como domicílio fiscal, nas Finanças, na Conservatória do Registo Comercial e em outras entidades. Com o contrato, você recebe a declaração que autoriza o uso da morada, exigida no registro.",
    },
    {
      q: "Ter a sede da empresa em um centro de negócios é legal?",
      a: "É. Trata-se de uma prática legal e comum em Portugal, usada por empresas de todos os tamanhos. O que importa é a correspondência oficial chegar até você, e é isso que o serviço garante.",
    },
    {
      q: "Quanto custa a morada fiscal para empresa?",
      a: "São três planos: Base, por 49 € por mês, Business, por 65 €, e Executive, por 89 €, sempre mais IVA. O contrato é anual e o pagamento é antecipado: por trimestre, por semestre, com 5% de desconto, ou por ano, com 10% de desconto.",
    },
    {
      q: "Qual a diferença entre sede social e domicílio fiscal?",
      a: "A sede social é a morada que consta nos estatutos e na Conservatória. O domicílio fiscal é a morada registrada nas Finanças. Na maioria dos casos as duas coincidem, e a mesma morada serve para ambas.",
    },
    {
      q: "Como funciona a correspondência da empresa?",
      a: "Toda carta é recebida na recepção e você é avisado por e-mail em 1 dia útil. No plano Base, a carta fica guardada para você buscar. Nos planos Business e Executive, ela é digitalizada e enviada para o seu e-mail. Tudo fica guardado por 90 dias.",
    },
    {
      q: "Posso contratar a morada antes de abrir a empresa?",
      a: "Pode, e faz sentido, porque a declaração de sede é pedida no registro. Você contrata em seu nome e a empresa assume o contrato depois de constituída. Se a empresa não for constituída em 90 dias, dá para cancelar sem multa.",
    },
    {
      q: "Moro no Brasil. Posso contratar sem ir a Portugal?",
      a: "Pode. O envio dos documentos, a assinatura do contrato e o pagamento são feitos à distância. Quem não mora em Portugal só precisa ter NIF português. Se você ainda não tem, a gente tira.",
    },
    {
      q: "Posso usar essa morada como meu endereço pessoal?",
      a: "Não. A morada é exclusivamente empresarial e não serve como domicílio de pessoa física. Para o seu NIF, a sua residência ou a sua carta de condução, o endereço é o de onde você mora.",
    },
    {
      q: "Qual é o prazo do contrato da morada fiscal?",
      a: "O contrato é anual e renova automaticamente por períodos iguais. Para cancelar, basta avisar com 30 dias de antecedência.",
    },
    {
      q: "Onde fica a morada?",
      a: "Na Rua Infante Dom Henrique, 111, no centro de Faro, no D'Faro Business Center. É o mesmo prédio da unidade SEVEN de Faro, então quem atende você está ao lado da sede da sua empresa.",
    },
  ],
  related: ["abrir-empresa-em-portugal", "contabilidade-em-portugal", "nif-portugal"],
  ctaTitle: "Empresa com endereço certo. Sempre existe um caminho.",
  ctaBody: "Da sede à contabilidade, a SEVEN acompanha a sua empresa em cada etapa. Fale com a gente e saia com a morada da sua empresa resolvida.",
};
