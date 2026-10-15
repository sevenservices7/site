import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Versão grande (retrato 720×900) da foto, usada no perfil ampliado, quando existe em public/team/large.
const PUBLIC = join(process.cwd(), 'public');
export function largePhoto(url?: string | null): string {
  if (!url || !url.startsWith('/team/')) return '';
  const large = url.replace('/team/', '/team/large/');
  return existsSync(join(PUBLIC, large)) ? large : '';
}
