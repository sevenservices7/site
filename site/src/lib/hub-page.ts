import { SITE_URL, breadcrumbLd } from './site';
import { solutionsFor, solutionPath } from '../data/solucoes';
import { getUi } from '../data/ui';
import { getRoute, type Lang } from '../i18n/ui';

/** JSON-LD do hub de soluções num idioma. */
export function hubJsonLd(lang: Lang) {
  const u = getUi(lang);
  return [
    breadcrumbLd([{ name: u.common.home, path: getRoute('home', lang) }, { name: u.common.solutions, path: getRoute('solutions', lang) }]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${u.common.solutions} SEVEN`,
      itemListElement: solutionsFor(lang).map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + solutionPath(lang, s), name: s.navLabel })),
    },
  ];
}
