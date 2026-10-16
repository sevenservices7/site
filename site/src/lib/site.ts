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
  youtube: 'https://www.youtube.com/@canaldaseven',
  spotify: '',
};

/** Redes sociais da SEVEN (rodapé). Vazio = ícone escondido até ter o link. */
export const SOCIAL: { key: string; label: string; href: string }[] = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/_sevenservices' },
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/sevenservices7' },
  { key: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@canaldaseven' },
  { key: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/company/sevenservicesac/' },
  { key: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@sevenservices' },
  { key: 'threads', label: 'Threads', href: 'https://www.threads.com/@_sevenservices' },
];

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
