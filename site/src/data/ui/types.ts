// Textos fixos das páginas novas (home, hub de soluções, modelo de página de solução),
// um arquivo por idioma em src/data/ui/<lang>.ts. Os textos das soluções em si ficam em
// src/data/solucoes (PT) e src/data/solucoes-i18n/<lang> (EN/ES/FR).
export interface UiStrings {
  stages: Record<'decisao' | 'chegada' | 'residencia' | 'nacionalidade' | 'empresa' | 'apoio', { title: string; summary: string }>;
  common: {
    home: string; solutions: string; talkToExpert: string; bookConsult: string; whatsapp: string; learnMore: string; seeAllSolutions: string;
    breadcrumbAria: string; anyStage: string; stage: string; waGeneric: string; waTopic: string; // waTopic usa {topic}
  };
  solution: {
    forWho: string; dictionary: string; whatWeDo: string; howItWorks: string; faqEyebrow: string; faqTitle: string;
    nextSteps: string; nextStepsTitle: string; statement: string;
  };
  hub: {
    metaTitle: string; metaDescription: string; eyebrow: string; h1: string; h1Em: string; lede: string;
    ctaStatement: string; ctaTitle: string; ctaBody: string;
  };
  home: {
    metaTitle: string; metaDescription: string;
    eyebrow: string; h1: string; h1Em: string; lede: string; ctaSecondary: string;
    highlights: { value: string; label: string }[];
    journeyEyebrow: string; journeyTitle: string; journeyLead: string;
    wayEyebrow: string; wayTitle: string; wayLead: string; principles: [string, string, string][];
    bizEyebrow: string; bizTitle: string; bizLead: string;
    bizCards: { title: string; body: string }[];
    testimonialsEyebrow: string; testimonialsTitle: string;
    unitsEyebrow: string; unitsTitle: string; unitsLead: string;
    closingStatement: string; closingTitle: string; closingBody: string;
  };
}
