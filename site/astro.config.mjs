// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// Rascunhos (draft: true) do blog e do podcast ficam fora do sitemap.
const draftPaths = ['blog', 'podcast'].flatMap((col) => {
  const dir = new URL(`./src/content/${col}/`, import.meta.url);
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return []; }
  return files
    .filter((f) => /^draft:\s*true\s*$/m.test(readFileSync(new URL(f, dir), 'utf8')))
    .map((f) => `/${col}/${f.replace(/\.md$/, '')}/`);
});
const redirectPaths = ['/lander/', '/servicos/', '/carrinho/', '/en/services/', '/en/cart/', '/es/servicios/', '/es/carrito/'];

// Site institucional SEVEN.
// i18n: PT é o idioma padrão e fica nas URLs limpas (/, /sobre, ...).
// EN/ES/FR ficam prefixados (/en/..., /es/..., /fr/...).
export default defineConfig({
  site: 'https://seveneu.com',
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'pt',
    locales: ['pt', 'en', 'es', 'fr'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: true,
    },
  },
  // Páginas antigas (catálogo e carrinho) → destinos novos. Geram HTML de redirecionamento com noindex.
  redirects: {
    '/lander': '/',
    '/servicos': '/solucoes',
    '/carrinho': '/solucoes',
    '/en/services': '/en/solutions',
    '/en/cart': '/en/solutions',
    '/es/servicios': '/es/soluciones',
    '/es/carrito': '/es/soluciones',
    '/en/vehicle-legalization': '/en/solutions',
    '/es/legalizacion-de-vehiculos': '/es/soluciones',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !draftPaths.includes(path) && !redirectPaths.includes(path) && !path.startsWith('/checkout') && !path.startsWith('/en/checkout') && !path.startsWith('/es/checkout') && !path.startsWith('/fr/checkout') && !/\/(pagar|pay)\/?$/.test(path);
      },
      i18n: {
        defaultLocale: 'pt',
        locales: { pt: 'pt-BR', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' },
      },
    }),
  ],
  build: {
    format: 'directory',
  },
});
