import type { Solution } from '../data/solution-types';
import { keyOf, solutionPath } from '../data/solucoes';
import { getUi } from '../data/ui';
import { getRoute, type Lang } from '../i18n/ui';
import { SITE_URL, breadcrumbLd, faqLd } from './site';

const inLanguage = { pt: 'pt-BR', en: 'en', es: 'es', fr: 'fr' } as const;

/** JSON-LD (Service + FAQPage + Breadcrumb) de uma página de solução. */
export function solutionJsonLd(lang: Lang, s: Solution) {
  const u = getUi(lang);
  const path = solutionPath(lang, s);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: s.navLabel,
      serviceType: s.navLabel,
      description: s.metaDescription,
      url: SITE_URL + path,
      inLanguage: inLanguage[lang],
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: { '@type': 'Country', name: 'Portugal' },
      identifier: keyOf(s),
    },
    faqLd(s.faqs),
    breadcrumbLd([
      { name: u.common.home, path: getRoute('home', lang) },
      { name: u.common.solutions, path: getRoute('solutions', lang) },
      { name: s.navLabel, path },
    ]),
  ];
}
