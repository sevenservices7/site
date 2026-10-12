import type { Lang } from '../i18n/ui';
import type { Office } from './data';

const localeMap: Record<Lang, string> = { pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' };

/** Nome do serviço no idioma ativo (cai no PT se não houver tradução). */
export function localName(s: { name: string; name_en?: string; name_es?: string }, lang: Lang): string {
  if (lang === 'en') return s.name_en || s.name;
  if (lang === 'es') return s.name_es || s.name;
  return s.name;
}

const FAMILY_LABELS: Record<string, { en: string; es: string; fr: string }> = {
  'A.T - Finanças': { en: 'Tax Authority', es: 'Hacienda', fr: 'Administration fiscale' },
  'Docs. Brasil': { en: 'Brazil Documents', es: 'Documentos Brasil', fr: 'Documents du Brésil' },
  'Segurança Social': { en: 'Social Security', es: 'Seguridad Social', fr: 'Sécurité sociale' },
  'Juridico': { en: 'Legal', es: 'Jurídico', fr: 'Juridique' },
  'Contabilidade': { en: 'Accounting', es: 'Contabilidad', fr: 'Comptabilité' },
  'Outros': { en: 'Other', es: 'Otros', fr: 'Autres' },
};
/** Rótulo da família no idioma ativo (AIMA/IMT mantêm-se; 'Juridico' mostra com acento em PT). */
export function familyLabel(family: string, lang: Lang): string {
  if (lang === 'pt') return family === 'Juridico' ? 'Jurídico' : family;
  return FAMILY_LABELS[family]?.[lang] ?? family;
}

export function money(value: number | null | undefined, lang: Lang): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(localeMap[lang], { style: 'currency', currency: 'EUR' }).format(value);
}

export function dateLong(value: string | null | undefined, lang: Lang): string {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(localeMap[lang], { year: 'numeric', month: 'long' }).format(new Date(value));
  } catch {
    return '';
  }
}

export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Link de WhatsApp wa.me com mensagem pré-preenchida. */
export function waLink(whatsapp: string, text = ''): string {
  const num = (whatsapp || '').replace(/\D/g, '');
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return num ? `https://wa.me/${num}${q}` : '#';
}

/** Link do Google Maps a partir da unidade. */
export function mapsLink(o: Pick<Office, 'maps_url' | 'lat' | 'lng' | 'address'>): string {
  if (o.maps_url) return o.maps_url;
  if (o.lat != null && o.lng != null) return `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address || 'Seven Services')}`;
}

/** URL de embed do mapa (iframe). Usa a morada real (mais fiável que as
 *  coordenadas; um link goo.gl encurtado não pode ser embebido em iframe). */
export function mapEmbed(o: Pick<Office, 'lat' | 'lng' | 'address'>): string {
  const q = o.address || (o.lat != null && o.lng != null ? `${o.lat},${o.lng}` : 'Portugal');
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}
