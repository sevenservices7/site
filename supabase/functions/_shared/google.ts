interface ServiceAccount { client_email: string; private_key: string; }
function sa(): ServiceAccount | null {
  const raw = Deno.env.get('GOOGLE_SA_JSON');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export const CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') || '';
export const TIMEZONE = Deno.env.get('CONSULT_TIMEZONE') || 'Europe/Lisbon';
export function calendarEnabled(): boolean { return Boolean(sa() && CALENDAR_ID); }
function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/[^A-Za-z0-9+/=]/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
let cachedToken: { token: string; exp: number } | null = null;
async function getAccessToken(): Promise<string | null> {
  const acct = sa();
  if (!acct) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: acct.client_email, scope: 'https://www.googleapis.com/auth/calendar', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const toSign = `${header}.${claim}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(acct.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${b64url(sigBuf)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  if (!res.ok) { console.error('google token', await res.text().catch(() => '')); return null; }
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}
export async function googleBusy(from: string, to: string): Promise<{ start: string; end: string }[]> {
  if (!calendarEnabled()) return [];
  const token = await getAccessToken();
  if (!token) throw new Error('calendar_auth_failed');
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeMin: from, timeMax: to, items: [{ id: CALENDAR_ID }] }) });
  if (!res.ok) throw new Error('calendar_availability_failed');
  const data = await res.json();
  const calendar = data.calendars?.[CALENDAR_ID];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error('calendar_availability_failed');
  return calendar.busy;
}
export async function createCalendarEvent(input: { summary: string; description?: string; start: string; end: string; attendeeEmail?: string; }): Promise<string | null> {
  if (!calendarEnabled()) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: input.summary, description: input.description || '', start: { dateTime: input.start, timeZone: TIMEZONE }, end: { dateTime: input.end, timeZone: TIMEZONE }, attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined }) });
  if (!res.ok) { console.error('google createEvent', await res.text().catch(() => '')); return null; }
  const data = await res.json();
  return data.id ?? null;
}
