import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { googleBusy, TIMEZONE } from '../_shared/google.ts';

// Consultas de 30 em 30 minutos, das 10h às 17h (último horário 16h30), dias úteis, na hora de Portugal.
const SLOT_MIN = 30;
const DAY_START_MIN = 10 * 60;
const DAY_END_MIN = 17 * 60;
const MAX_DAYS = 30;

/** Partes de data/hora de um instante no fuso indicado. */
function partsIn(ts: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd: p.weekday as string };
}
/** Converte uma hora "de parede" no fuso indicado para o instante UTC. */
function wallToUtc(y: number, m: number, d: number, minutes: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const p = partsIn(guess, tz);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess;
  return guess - offset;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const now = Date.now();
    const until = now + MAX_DAYS * 864e5;
    const sb = adminClient();
    const { data: bk } = await sb.from('bookings').select('slot_start,slot_end').in('status', ['pending', 'paid', 'confirmed']).gte('slot_end', new Date(now).toISOString()).lte('slot_start', new Date(until).toISOString());
    const busy: { start: number; end: number }[] = (bk || []).map((b: any) => ({ start: new Date(b.slot_start).getTime(), end: new Date(b.slot_end).getTime() }));
    for (const g of await googleBusy(new Date(now).toISOString(), new Date(until).toISOString())) busy.push({ start: new Date(g.start).getTime(), end: new Date(g.end).getTime() });
    const overlaps = (s: number, e: number) => busy.some((b) => b.start < e && b.end > s);

    const slots: { start: string; end: string }[] = [];
    for (let i = 0; i <= MAX_DAYS; i++) {
      const day = partsIn(now + i * 864e5, TIMEZONE);
      if (day.wd === 'Sat' || day.wd === 'Sun') continue;
      for (let t = DAY_START_MIN; t + SLOT_MIN <= DAY_END_MIN; t += SLOT_MIN) {
        const s = wallToUtc(day.y, day.m, day.d, t, TIMEZONE);
        const e = s + SLOT_MIN * 60000;
        if (s > now + 60 * 60000 && !overlaps(s, e)) slots.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
      }
    }
    return json({ slots, timezone: TIMEZONE }, 200, origin);
  } catch (e) {
    console.error('get-availability', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
