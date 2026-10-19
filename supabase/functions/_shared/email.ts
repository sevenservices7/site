const FROM = Deno.env.get('EMAIL_FROM') || 'SEVEN <contato@seveneu.com>';
export async function sendEmail(to: string, subject: string, html: string, opts: { from?: string; replyTo?: string } = {}): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key || !to) return false;
  const payload: Record<string, unknown> = { from: opts.from || FROM, to, subject, html };
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) { console.error('resend', await res.text().catch(() => '')); return false; }
  return true;
}
export function orderEmail(locale: string, amount: number): { subject: string; html: string } {
  const eur = `€${Number(amount).toFixed(2)}`;
  if (locale === 'en') return { subject: 'Your Seven Services payment', html: `<p>Thank you! We received your payment of <b>${eur}</b>.</p><p>Our team will be in touch shortly.</p>` };
  if (locale === 'es') return { subject: 'Su pago en Seven Services', html: `<p>¡Gracias! Recibimos su pago de <b>${eur}</b>.</p><p>Nuestro equipo se pondrá en contacto pronto.</p>` };
  return { subject: 'O seu pagamento na Seven Services', html: `<p>Obrigado! Recebemos o seu pagamento de <b>${eur}</b>.</p><p>A nossa equipa entrará em contacto em breve.</p>` };
}
export function bookingEmail(locale: string, startsAt: string): { subject: string; html: string } {
  const loc = locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-ES' : 'pt-PT';
  const fmt = new Date(startsAt).toLocaleString(loc, { dateStyle: 'full', timeStyle: 'short' });
  if (locale === 'en') return { subject: 'Your consultation is confirmed', html: `<p>Your consultation is confirmed for <b>${fmt}</b>.</p><p>We look forward to speaking with you.</p>` };
  if (locale === 'es') return { subject: 'Su consultoría está confirmada', html: `<p>Su consultoría está confirmada para <b>${fmt}</b>.</p><p>Le esperamos.</p>` };
  return { subject: 'A sua consultoria está confirmada', html: `<p>A sua consultoria está confirmada para <b>${fmt}</b>.</p><p>Até breve!</p>` };
}
