import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function api(configured = true) {
  const { outputFiles } = await build({ entryPoints: ['src/lib/api.ts'], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'test-config', setup(build) {
    build.onResolve({ filter: /^\.\/config$/ }, () => ({ path: 'config', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export const FUNCTIONS_URL = ${JSON.stringify(configured ? 'https://api.invalid' : '')}; export const SUPABASE_ANON_KEY = ${JSON.stringify(configured ? 'test-only' : '')};` }));
  } }] });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text + `\n//${Math.random()}`).toString('base64')}`);
}

test('availability wrapper passes language, range and authentication to a mocked fetch', async (t) => {
  const a = await api();
  let request;
  t.mock.method(globalThis, 'fetch', async (...args) => { request = args; return Response.json({ slots: [] }); });
  const input = { language: 'es', from: '2030-01-01T00:00:00Z', to: '2030-01-02T00:00:00Z' };
  assert.deepEqual(await a.getAvailability(input), { slots: [] });
  assert.equal(request[0], 'https://api.invalid/get-availability');
  assert.deepEqual(JSON.parse(request[1].body), input); assert.equal(request[1].headers.apikey, 'test-only');
});
test('HTTP failure exposes structured status/code without leaking response details', async (t) => {
  const a = await api();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'slot_taken', details: 'private' }, { status: 409 }));
  await assert.rejects(a.createBooking({}), (error) => error instanceof a.ApiError && error.status === 409 && error.code === 'slot_taken' && !error.message.includes('private'));
});
test('non-JSON HTTP errors still expose the status', async (t) => {
  const a = await api();
  t.mock.method(globalThis, 'fetch', async () => new Response('gateway failed', { status: 502 }));
  await assert.rejects(a.createBooking({}), (error) => error.status === 502 && error.code === 'request_failed');
});
test('booking wrapper rejects a malformed successful response', async (t) => {
  const a = await api(); t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(a.createBooking({}), /invalid_booking_response/);
});
for (const url of [null, '', 'javascript:alert(1)', 'http://checkout.stripe.com/pay', 'https://checkout.stripe.com.evil.invalid/pay', 'https://user:pass@checkout.stripe.com/pay']) test(`checkout wrapper rejects unsafe URL ${url}`, async (t) => {
  const a = await api(); t.mock.method(globalThis, 'fetch', async () => Response.json({ url }));
  await assert.rejects(a.createBookingCheckout('test-booking', 'pt'));
});
test('checkout wrapper accepts hosted HTTPS Stripe URL', async (t) => {
  const a = await api(); t.mock.method(globalThis, 'fetch', async () => Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_fake' }));
  assert.equal((await a.createBookingCheckout('test-booking', 'en')).url, 'https://checkout.stripe.com/c/pay/cs_test_fake');
});
test('missing API configuration does not make a network request', async (t) => {
  const a = await api(false); t.mock.method(globalThis, 'fetch', () => { throw new Error('network forbidden'); });
  await assert.rejects(a.getAvailability({}), (error) => error.code === 'api_not_configured');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
test('booking API timeout aborts a hung request', async (t) => {
  const a = await api();
  const nativeTimer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, ms) => nativeTimer(fn, ms === 20000 ? 1 : ms));
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  await assert.rejects(a.getAvailability({}), (error) => error.name === 'AbortError');
});
