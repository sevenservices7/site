import { preflight, json } from '../_shared/cors.ts';
import { createKommoLead } from '../_shared/kommo.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json();
    if (body.company) return json({ ok: true }, 200, origin);
    if (!body.name || !body.email || !body.phone) return json({ error: 'missing_fields' }, 400, origin);
    const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
    if (!human) return json({ error: 'turnstile_failed' }, 400, origin);
    const result = await createKommoLead({ name: String(body.name), email: String(body.email), phone: String(body.phone), unit_slug: body.unit_slug ? String(body.unit_slug) : undefined, language: body.language ? String(body.language) : 'pt', service_code: body.service_code ? String(body.service_code) : undefined, message: body.message ? String(body.message) : undefined, source: 'website', whatsapp_consent: body.whatsapp_consent === true });
    return json(result, 200, origin);
  } catch (e) {
    console.error('kommo-lead', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
