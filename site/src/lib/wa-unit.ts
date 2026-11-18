// Distribuição dos cliques no WhatsApp entre as unidades (código do browser).
//  - Quem preencheu o formulário: fica a unidade que o round robin do Kommo escolheu.
//  - Quem clica direto num botão genérico: sorteio entre as unidades abertas (≈1/3 cada).
// A unidade fica guardada no navegador, para a mesma pessoa não abrir conversa em dois WhatsApp.
const KEY = 'seven_wa_unit';

export function savedUnit(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function saveUnit(slug: string): void {
  try { localStorage.setItem(KEY, slug); } catch {}
}

/** Unidade guardada (se ainda existir) ou uma sorteada. Não grava: só grava quem clica. */
export function pickUnit(units: Record<string, string>): string | null {
  const slugs = Object.keys(units);
  if (!slugs.length) return null;
  const saved = savedUnit();
  if (saved && units[saved]) return saved;
  return slugs[Math.floor(Math.random() * slugs.length)];
}
