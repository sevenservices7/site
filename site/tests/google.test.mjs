import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function calendar(env) {
  globalThis.__calendarEnv = env;
  const { outputFiles } = await build({ entryPoints: ['../supabase/functions/_shared/google.ts'], bundle: true, write: false, format: 'esm', platform: 'node', banner: { js: 'const Deno = { env: { get: (key) => globalThis.__calendarEnv[key] } };' } });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text + `\n//${Math.random()}`).toString('base64')}`);
}
async function configured() {
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64');
  return calendar({ GOOGLE_CALENDAR_ID: 'test-calendar', GOOGLE_SA_JSON: JSON.stringify({ client_email: 'test@example.invalid', private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----` }) });
}
test('unconfigured Google Calendar explicitly uses database-only availability', async (t) => {
  const c = await calendar({}); t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  assert.deepEqual(await c.googleBusy('2030-01-01', '2030-01-02'), []); assert.equal(globalThis.fetch.mock.callCount(), 0);
});
for (const mode of ['auth', 'http', 'calendar', 'malformed']) test(`configured calendar ${mode} failure never returns a free calendar`, async (t) => {
  const c = await configured();
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('oauth2')) return mode === 'auth' ? new Response('', { status: 401 }) : Response.json({ access_token: 'test-only', expires_in: 3600 });
    if (mode === 'http') return new Response('', { status: 503 });
    return Response.json({ calendars: { 'test-calendar': mode === 'calendar' ? { errors: [{ reason: 'notFound' }] } : {} } });
  });
  await assert.rejects(c.googleBusy('2030-01-01', '2030-01-02'), /calendar_.*failed/);
});
