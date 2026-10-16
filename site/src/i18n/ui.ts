import pt from './pt.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';

export const languages = { pt: 'Português', en: 'English', es: 'Español', fr: 'Français' } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'pt';

const dictionaries: Record<Lang, Record<string, string>> = { pt, en, es, fr };

/** Detecta o idioma a partir da URL (PT na raiz; EN/ES/FR prefixados). */
export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split('/');
  if (seg === 'en' || seg === 'es' || seg === 'fr') return seg;
  return defaultLang;
}

/** Retorna a função de tradução t() para o idioma, com fallback para PT. */
export function useTranslations(lang: Lang) {
  return function t(key: string): string {
    return dictionaries[lang]?.[key] ?? dictionaries[defaultLang][key] ?? key;
  };
}

/** Mapa de rotas estáticas por idioma (slug localizado). */
export const ROUTES = {
  home: { pt: '/', en: '/en/', es: '/es/', fr: '/fr/' },
  solutions: { pt: '/solucoes', en: '/en/solutions', es: '/es/soluciones', fr: '/fr/solutions' },
  about: { pt: '/sobre', en: '/en/about', es: '/es/sobre', fr: '/fr/a-propos' },
  values: { pt: '/missao-e-valores', en: '/en/mission-and-values', es: '/es/mision-y-valores', fr: '/fr/mission-et-valeurs' },
  units: { pt: '/unidades', en: '/en/units', es: '/es/unidades', fr: '/fr/agences' },
  team: { pt: '/equipa', en: '/en/team', es: '/es/equipo', fr: '/fr/equipe' },
  expert: { pt: '/falar-com-especialista', en: '/en/talk-to-an-expert', es: '/es/hablar-con-un-especialista', fr: '/fr/parler-a-un-specialiste' },
  booking: { pt: '/agendamento', en: '/en/booking', es: '/es/agenda', fr: '/fr/rendez-vous' },
  contact: { pt: '/contato', en: '/en/contact', es: '/es/contacto', fr: '/fr/contact' },
  terms: { pt: '/legal/termos', en: '/en/legal/terms', es: '/es/legal/terminos', fr: '/fr/legal/conditions' },
  privacy: { pt: '/legal/privacidade', en: '/en/legal/privacy', es: '/es/legal/privacidad', fr: '/fr/legal/confidentialite' },
} as const;
export type RouteKey = keyof typeof ROUTES;

/** Caminho localizado para uma rota estática conhecida. */
export function getRoute(key: RouteKey, lang: Lang): string {
  return ROUTES[key][lang];
}

/** Caminho localizado da página de uma unidade pelo slug. */
export function unitPath(slug: string, lang: Lang): string {
  if (lang === 'en') return `/en/units/${slug}`;
  if (lang === 'es') return `/es/unidades/${slug}`;
  if (lang === 'fr') return `/fr/agences/${slug}`;
  return `/unidades/${slug}`;
}

/** Prefixo do idioma para montar caminhos arbitrários. */
export function langPrefix(lang: Lang): string {
  return lang === 'pt' ? '' : `/${lang}`;
}
