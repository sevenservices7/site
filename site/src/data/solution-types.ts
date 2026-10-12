// Tipos das páginas de solução (uma página por intenção de busca, estilo landing page).
// Cada solução vive em src/data/solucoes/<slug>.ts e é registada em src/data/solucoes/index.ts.

/** Etapa da jornada do cliente (esteira E0–E5). */
export type Stage = 'decisao' | 'chegada' | 'residencia' | 'nacionalidade' | 'empresa' | 'apoio';

export interface TextItem { title: string; body: string; }
export interface Faq { q: string; a: string; }

export interface Solution {
  /** Slug da URL, sem barras: a página fica em /<slug> (PT) ou /<lang>/<slug> (EN/ES/FR). */
  slug: string;
  /** Só nas traduções: o slug da versão em português (liga as versões entre idiomas). */
  key?: string;
  stage: Stage;
  /** Nome curto para menus e cartões (2–4 palavras). */
  navLabel: string;
  /** Uma frase para o cartão no hub /solucoes (até ~110 caracteres). */
  cardSummary: string;
  /** <title>: palavra-chave primeiro, até ~60 caracteres, termina em " | SEVEN". */
  seoTitle: string;
  /** Meta description: 140–160 caracteres, com a palavra-chave e um benefício. */
  metaDescription: string;
  /** Rótulo acima do H1 (caixa alta via CSS). Ex.: "Imigração · Portugal". */
  eyebrow: string;
  /** H1 com a palavra-chave principal, na voz da SEVEN. */
  h1: string;
  /** Subtítulo do hero: 1–2 frases. */
  lede: string;
  /** 3–4 destaques curtos no hero (ex.: { value: '100%', label: 'acompanhado à distância' }). Sem números inventados. */
  highlights: { value: string; label: string }[];
  /** H2 da seção "para quem é". */
  forWhoTitle: string;
  forWho: TextItem[];
  /** Termo técnico traduzido (Dicionário da Seven), opcional. */
  dictionary?: { term: string; meaning: string }[];
  /** H2 da seção "o que a gente faz". */
  includedTitle: string;
  included: TextItem[];
  /** H2 da seção "como funciona". */
  stepsTitle: string;
  steps: TextItem[];
  /** Caixa "Importante" (mudança de lei, prazos, alertas), tom sereno. */
  important?: TextItem;
  /** Indicação externa opcional (ex.: morada fiscal → dfaro.pt). */
  external?: { title: string; body: string; label: string; href: string };
  /** 6–10 perguntas reais, redigidas como a pessoa pesquisa no Google. */
  faqs: Faq[];
  /** Slugs de outras soluções relacionadas (2–4). */
  related: string[];
  /** Fecho da página. */
  ctaTitle: string;
  ctaBody: string;
}
