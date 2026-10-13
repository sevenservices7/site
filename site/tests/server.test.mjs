import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const nativeFetch = globalThis.fetch;
before(() => { globalThis.fetch = () => { throw new Error('External network is forbidden in booking tests'); }; });
after(() => { globalThis.fetch = nativeFetch; delete globalThis.__testDependencies; delete globalThis.__testDeno; });

function database(responses = []) {
  const calls = [];
  return {
    calls,
    from(table) {
      const chain = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve, reject) => Promise.resolve(responses.shift() || { data: null, error: null }).then(resolve, reject);
        return (...args) => {
          calls.push({ table, method, args });
          if (method === 'single' || method === 'limit') return Promise.resolve(responses.shift() || { data: null, error: null });
          return chain;
        };
      } });
      return chain;
    },
  };
}

async function handler(name, options = {}) {
  const db = database(options.responses);
  const stripeCalls = [];
  globalThis.__testDependencies = {
    db,
    googleBusy: async () => { if (options.calendarError) throw new Error('calendar failed'); return options.busy || []; },
    verifyTurnstile: async () => options.human !== false,
    stripe: { checkout: { sessions: { create: async (...args) => {
      stripeCalls.push(args);
      if (options.stripeError) throw new Error('Stripe failed');
      return { id: 'cs_test_fake', url: options.missingUrl ? null : 'https://checkout.stripe.com/c/pay/cs_test_fake' };
    } } } },
  };
  globalThis.__testDeno = { env: { get: () => undefined }, serve(fn) { this.handler = fn; } };
  const { outputFiles } = await build({
    entryPoints: [`../supabase/functions/${name}/index.ts`], bundle: true, write: false, format: 'esm', platform: 'node',
    banner: { js: 'const Deno = globalThis.__testDeno; const console = { error: () => {} };' },
    plugins: [{ name: 'isolated-external-dependencies', setup(build) {
      build.onResolve({ filter: /_shared\/(clients|google|turnstile)\.ts$/ }, ({ path }) => ({ path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
        path.endsWith('clients.ts') ? 'export const adminClient = () => globalThis.__testDependencies.db; export const stripeClient = () => globalThis.__testDependencies.stripe; export const checkoutUrls = () => ({success:"https://example.invalid/success",cancel:"https://example.invalid/cancel"});' :
        path.endsWith('google.ts') ? 'export const googleBusy = (...args) => globalThis.__testDependencies.googleBusy(...args);' :
        'export const verifyTurnstile = (...args) => globalThis.__testDependencies.verifyTurnstile(...args);' }));
    } }],
  });
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text + `\n// ${Math.random()}`).toString('base64')}`);
  return { db, stripeCalls, run: (body) => globalThis.__testDeno.handler(new Request('https://functions.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) };
}
const start = () => new Date(Date.now() + 864e5).toISOString();
function booking(overrides = {}) {
  const slot_start = start();
  return { language: 'en', slot_start, slot_end: new Date(Date.parse(slot_start) + 45 * 60000).toISOString(), customer: { name: '  Jane Doe  ', email: ' jane@example.invalid ', phone: '+44 (123) 456-7890' }, ...overrides };
}
const payable = () => ({ id: 'booking-test', status: 'pending', language: 'en', amount: 80, slot_start: start() });

for (const [label, overrides] of [
  ['unsupported language', { language: 'fr' }], ['invalid dates', { slot_start: 'bad' }],
  ['past slot', { slot_start: '2020-01-01T09:00:00Z' }], ['inverted range', { slot_end: '2020-01-01T09:00:00Z' }],
  ['missing timezone', { slot_start: '2030-01-01T09:00:00' }], ['wrong duration', { slot_end: '2030-01-01T09:00:00Z' }],
  ['blank name', { customer: { name: ' ', email: 'a@example.invalid' } }],
  ['invalid email', { customer: { name: 'Jane', email: 'wrong' } }],
  ['invalid phone', { customer: { name: 'Jane', email: 'a@example.invalid', phone: '123' } }],
  ['WhatsApp without phone', { whatsapp_consent: true, customer: { name: 'Jane', email: 'a@example.invalid' } }],
]) test(`create-booking rejects ${label} before accessing database`, async () => {
  const h = await handler('create-booking');
  assert.equal((await h.run(booking(overrides))).status, 400);
  assert.equal(h.db.calls.length, 0);
});

test('create-booking trims valid customer data, persists language and optional consent', async () => {
  const h = await handler('create-booking', { responses: [{ data: { price: 80 } }, { data: [] }, { data: { id: 'booking-test', amount: 80 } }] });
  const response = await h.run(booking());
  assert.equal(response.status, 200);
  const insert = h.db.calls.find((c) => c.method === 'insert').args[0];
  assert.equal(insert.language, 'en'); assert.equal(insert.customer_name, 'Jane Doe'); assert.equal(insert.customer_email, 'jane@example.invalid');
  assert.equal(insert.whatsapp_consent, false);
});

test('Turnstile rejection does not insert a reservation', async () => {
  const h = await handler('create-booking', { human: false });
  assert.equal((await h.run(booking())).status, 400); assert.equal(h.db.calls.length, 0);
});
for (const scenario of [
  { label: 'database conflict', responses: [{ data: { price: 80 } }, { data: [{ id: 'existing' }] }], status: 409 },
  { label: 'calendar conflict', responses: [{ data: { price: 80 } }, { data: [] }], busy: [{ start: '2020-01-01T00:00:00Z', end: '2099-01-01T00:00:00Z' }], status: 409 },
  { label: 'conflict query error', responses: [{ data: { price: 80 } }, { error: 'database unavailable' }], status: 500 },
  { label: 'calendar error', responses: [{ data: { price: 80 } }, { data: [] }], calendarError: true, status: 500 },
  { label: 'missing service', responses: [{ data: null }], status: 503 },
  { label: 'zero price', responses: [{ data: { price: 0 } }], status: 503 },
]) test(`create-booking blocks ${scenario.label}`, async () => {
  const h = await handler('create-booking', scenario);
  assert.equal((await h.run(booking())).status, scenario.status);
  assert.equal(h.db.calls.some((c) => c.method === 'insert'), false);
});

for (const [label, body] of [['invalid language', { language: 'fr' }], ['invalid range', { from: 'bad' }], ['excessive range', { from: '2030-01-01', to: '2031-01-01' }]]) test(`get-availability rejects ${label}`, async () => {
  const h = await handler('get-availability');
  assert.equal((await h.run(body)).status, 400); assert.equal(h.db.calls.length, 0);
});
for (const language of ['pt', 'en', 'es']) test(`get-availability accepts ${language} on the shared calendar and respects bounds`, async () => {
  const h = await handler('get-availability', { responses: [{ data: [] }] });
  const from = '2030-01-07T09:15:00Z', to = '2030-01-07T18:00:00Z';
  const response = await h.run({ language, from, to });
  const { slots } = await response.json();
  assert.equal(response.status, 200); assert.ok(slots.length);
  for (const slot of slots) { assert.ok(Date.parse(slot.start) >= Date.parse(from)); assert.ok(Date.parse(slot.end) <= Date.parse(to)); }
  assert.ok(h.db.calls.some((c) => c.method === 'gt' && c.args[0] === 'slot_end'));
});
for (const options of [{ responses: [{ error: 'database failed' }] }, { responses: [{ data: [] }], calendarError: true }]) test('availability dependency failure returns an error, not a free calendar', async () => {
  const h = await handler('get-availability', options);
  assert.equal((await h.run({ language: 'pt' })).status, 500);
});

test('booking checkout uses one stable idempotency key and stored amount', async () => {
  const h = await handler('create-checkout-session', { responses: [{ data: payable() }, {}, { data: payable() }, {}] });
  for (let i = 0; i < 2; i++) assert.equal((await h.run({ mode: 'booking', booking_id: 'booking-test', locale: 'en' })).status, 200);
  assert.equal(h.stripeCalls.length, 2);
  assert.deepEqual(h.stripeCalls[0][1], { idempotencyKey: 'booking-checkout-booking-test' });
  assert.deepEqual(h.stripeCalls[0], h.stripeCalls[1]);
  assert.equal(h.stripeCalls[0][0].line_items[0].price_data.unit_amount, 8000);
});
for (const overrides of [{ status: 'confirmed' }, { status: 'cancelled' }, { slot_start: 'bad' }, { slot_start: '2020-01-01T00:00:00Z' }, { amount: 0 }, { amount: 'NaN' }]) test('checkout rejects an unpayable booking before calling Stripe', async () => {
  const h = await handler('create-checkout-session', { responses: [{ data: { ...payable(), ...overrides } }] });
  assert.equal((await h.run({ mode: 'booking', booking_id: 'booking-test' })).status, 409); assert.equal(h.stripeCalls.length, 0);
});
for (const options of [{ stripeError: true }, { missingUrl: true }]) test('checkout provider failure is reported', async () => {
  const h = await handler('create-checkout-session', { responses: [{ data: payable() }], ...options });
  assert.equal((await h.run({ mode: 'booking', booking_id: 'booking-test' })).status, 500);
});

for (const name of ['create-booking', 'get-availability', 'create-checkout-session']) test(`${name} rejects a null request without side effects`, async () => {
  const h = await handler(name);
  assert.equal((await h.run(null)).status, 400);
  assert.equal(h.db.calls.length, 0); assert.equal(h.stripeCalls.length, 0);
});
test('checkout reports failure to persist the session id', async () => {
  const h = await handler('create-checkout-session', { responses: [{ data: payable() }, { error: 'database unavailable' }] });
  assert.equal((await h.run({ mode: 'booking', booking_id: 'booking-test' })).status, 500);
  assert.equal(h.stripeCalls.length, 1);
});
