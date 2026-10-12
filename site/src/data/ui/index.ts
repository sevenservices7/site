import type { Lang } from '../../i18n/ui';
import type { UiStrings } from './types';
import { ui as pt } from './pt';

const modules = import.meta.glob<{ ui: UiStrings }>('./{en,es,fr}.ts', { eager: true });
const table: Partial<Record<Lang, UiStrings>> = { pt };
for (const [path, m] of Object.entries(modules)) table[path.slice(2, 4) as Lang] = m.ui;

/** Textos fixos das páginas novas no idioma pedido (cai para PT se a tradução não existir). */
export function getUi(lang: Lang): UiStrings {
  return table[lang] ?? pt;
}

/** Idiomas que já têm os textos fixos traduzidos. */
export function hasUi(lang: Lang): boolean {
  return Boolean(table[lang]);
}
