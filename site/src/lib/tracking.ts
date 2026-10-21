// Rastreamento das LPs de diagnóstico (tráfego pago).
// - UTMs, fbclid e referrer são capturados na chegada e ficam em sessionStorage até o envio do lead.
// - Eventos do Meta Pixel só disparam se o Pixel já estiver carregado, o que o CookieBanner só faz
//   com consentimento de marketing (RGPD). Eventos anteriores ao consentimento ficam em fila e
//   são enviados se a pessoa aceitar durante a visita; se recusar, são descartados.

const KEY = 'seven_attr';
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;
export type Atribuicao = Partial<Record<(typeof PARAMS)[number] | 'referrer', string>>;

/** Guarda os parâmetros de campanha da URL atual sem apagar os que já estavam na sessão. */
export function capturaAtribuicao(): Atribuicao {
  let atual: Atribuicao = {};
  try { atual = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch {}
  const qs = new URLSearchParams(location.search);
  for (const p of PARAMS) { const v = qs.get(p); if (v) atual[p] = v.slice(0, 300); }
  if (!atual.referrer && document.referrer && !document.referrer.startsWith(location.origin)) atual.referrer = document.referrer.slice(0, 300);
  try { sessionStorage.setItem(KEY, JSON.stringify(atual)); } catch {}
  return atual;
}

type Evento = 'Lead' | 'CompleteRegistration' | 'Schedule' | 'Contact';
const fila: [Evento, Record<string, unknown>, string?][] = [];
const w = window as any;

/** Dispara um evento padrão do Meta Pixel. `eventID` permite deduplicar com a Conversions API no futuro. */
export function track(evento: Evento, params: Record<string, unknown> = {}, eventID?: string) {
  if (typeof w.fbq === 'function') w.fbq('track', evento, params, eventID ? { eventID } : undefined);
  else fila.push([evento, params, eventID]);
}

window.addEventListener('seven:consent', (e: Event) => {
  const c = (e as CustomEvent).detail;
  if (!c?.marketing) { fila.length = 0; return; }
  // O CookieBanner acabou de carregar o Pixel; esvazia a fila.
  setTimeout(() => { while (fila.length) { const [ev, p, id] = fila.shift()!; track(ev, p, id); } }, 0);
});
