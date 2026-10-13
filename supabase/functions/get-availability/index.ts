import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { isConsultationLanguage } from '../_shared/booking.ts';
import { googleBusy } from '../_shared/google.ts';

const SLOT_MIN = Number(Deno.env.get('CONSULT_SLOT_MINUTES') || 45);
const DAY_START = 9;
const DAY_END = 18;
const MAX_DAYS = 14;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400, origin);
    const now = Date.now();
    const from = body.from ? new Date(body.from) : new Date(now);
    const to = body.to ? new Date(body.to) : new Date(from.getTime() + MAX_DAYS * 864e5);
    if (body.language != null && !isConsultationLanguage(body.language)) return json({ error: 'invalid_language' }, 400, origin);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_DAYS * 864e5) return json({ error: 'invalid_range' }, 400, origin);
    // All supported languages currently share the same calendar. No staff/language mapping exists here.
    const sb = adminClient();
    const { data: bk, error: bookingError } = await sb.from('bookings').select('slot_start,slot_end').in('status', ['pending', 'paid', 'confirmed']).lt('slot_start', to.toISOString()).gt('slot_end', from.toISOString());
    if (bookingError) throw bookingError;
    const busy: { start: number; end: number }[] = (bk || []).map((b: any) => ({ start: new Date(b.slot_start).getTime(), end: new Date(b.slot_end).getTime() }));
    for (const g of await googleBusy(from.toISOString(), to.toISOString())) busy.push({ start: new Date(g.start).getTime(), end: new Date(g.end).getTime() });
    const overlaps = (s: number, e: number) => busy.some((b) => b.start < e && b.end > s);
    const slots: { start: string; end: string }[] = [];
    const cursor = new Date(from);
    cursor.setMinutes(0, 0, 0);
    if (cursor.getTime() < Date.now()) cursor.setTime(Date.now());
    if (cursor.getTime() < from.getTime()) cursor.setTime(from.getTime());
    while (cursor < to && slots.length < 60) {
      const day = cursor.getDay();
      const hour = cursor.getHours();
      const businessDay = day >= 1 && day <= 5;
      if (businessDay && hour >= DAY_START && hour < DAY_END) {
        const s = cursor.getTime();
        const e = s + SLOT_MIN * 60000;
        const closing = new Date(cursor);
        closing.setHours(DAY_END, 0, 0, 0);
        if (s > Date.now() && e <= to.getTime() && e <= closing.getTime() && !overlaps(s, e)) slots.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
        cursor.setTime(cursor.getTime() + SLOT_MIN * 60000);
      } else if (businessDay && hour < DAY_START) {
        cursor.setHours(DAY_START, 0, 0, 0);
      } else {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(DAY_START, 0, 0, 0);
      }
    }
    return json({ slots }, 200, origin);
  } catch (e) {
    console.error('get-availability', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
