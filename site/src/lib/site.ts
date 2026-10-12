import { getOffices } from './data';
import { getUi } from '../data/ui';
import type { Lang } from '../i18n/ui';

export const SITE_URL = 'https://seveneu.com';

/** WhatsApp principal da SEVEN (primeira unidade ativa). */
export async function mainWhatsapp(): Promise<string> {
  const offices = await getOffices();
  return offices.find((o) => o.is_open && o.whatsapp)?.whatsapp ?? '';
}

/** Mensagem pré-preenchida do WhatsApp para uma página. */
export function waText(topic?: string, lang: Lang = 'pt'): string {
  const c = getUi(lang).common;
  return topic ? c.waTopic.replace('{topic}', topic) : c.waGeneric;
}

/** Breadcrumb JSON-LD. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE_URL + it.path })),
  };
}

/** FAQPage JSON-LD. */
export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

/** Links do podcast. Preencha quando o canal estiver no ar; vazio = botão escondido. */
export const PODCAST_LINKS = {
  youtube: 'https://www.youtube.com/@Seven.Business',
  spotify: '',
};

/** Article JSON-LD. */
export function articleLd(a: { title: string; description: string; path: string; pubDate: Date; updatedDate?: Date; author: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    mainEntityOfPage: SITE_URL + a.path,
    datePublished: a.pubDate.toISOString(),
    dateModified: (a.updatedDate ?? a.pubDate).toISOString(),
    author: { '@type': 'Organization', name: a.author },
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'pt-BR',
  };
}
