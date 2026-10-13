import { test, expect, type Page, type Route } from '@playwright/test';

const API = 'https://booking-tests.invalid/functions/v1/';
const slot = (index = 0) => {
  const start = Date.now() + (index + 1) * 864e5;
  return { start: new Date(start).toISOString(), end: new Date(start + 45 * 60000).toISOString() };
};
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

async function setup(page: Page, overrides: Partial<Record<string, (route: Route) => Promise<unknown>>> = {}) {
  const calls: { endpoint: string; body: any }[] = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(API)) {
      const endpoint = url.slice(API.length);
      if (route.request().method() === 'OPTIONS') return reply(route, {});
      calls.push({ endpoint, body: route.request().postDataJSON() });
      if (overrides[endpoint]) return overrides[endpoint]!(route);
      if (endpoint === 'get-availability') return reply(route, { slots: [slot()] });
      if (endpoint === 'create-booking') return reply(route, { booking_id: 'booking-test', amount: 80 });
      if (endpoint === 'create-checkout-session') return reply(route, { url: 'https://checkout.stripe.com/c/pay/cs_test_fake' });
      return route.abort();
    }
    if (url.startsWith('http://127.0.0.1:4321/')) return route.continue();
    // Checkout navigation is served locally by the test; no payment provider is contacted.
    if (url === 'https://checkout.stripe.com/c/pay/cs_test_fake') return route.fulfill({ body: '<h1>Simulated checkout</h1>', contentType: 'text/html' });
    return route.abort();
  });
  return calls;
}
async function selectAndFill(page: Page) {
  await page.locator('.slot-opt').first().click();
  await page.locator('[data-b-name]').fill('  Jane Doe  ');
  await page.locator('[data-b-email]').fill('jane@example.invalid');
  await page.locator('[data-b-phone]').fill('+44 123 456 7890');
}

for (const [path, language] of [['/agendamento', 'pt'], ['/en/booking', 'en'], ['/es/agenda', 'es'], ['/fr/rendez-vous', 'en']]) {
  test(`initial consultation language on ${path}`, async ({ page }) => {
    const calls = await setup(page);
    await page.goto(path); await expect(page.locator('.slot-opt')).toHaveCount(1);
    expect(calls[0].body.language).toBe(language);
    await expect(page.locator(`[data-l="${language}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-slots-retry]')).toBeHidden();
  });
}

test('language change discards the selected slot, shows loading, then reserves the new language/slot', async ({ page }) => {
  const pt = slot(), en = slot(1);
  let pending: Route | undefined;
  const calls = await setup(page, { 'get-availability': async (route) => {
    if (route.request().postDataJSON().language === 'pt') return reply(route, { slots: [pt] });
    pending = route;
  } });
  await page.goto('/agendamento'); await selectAndFill(page);
  await page.locator('[data-l="en"]').click();
  await expect(page.locator('[data-book-details]')).toBeHidden();
  await expect(page.locator('.slot-opt')).toHaveCount(0);
  await expect(page.locator('[data-slots]')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-availability-status]')).toContainText('Carregando');
  await expect.poll(() => Boolean(pending)).toBe(true);
  await reply(pending!, { slots: [en] });
  await expect(page.locator('[data-slots]')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.slot-opt').click(); await page.locator('[data-book-pay]').click();
  await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test_fake');
  const reservation = calls.find((c) => c.endpoint === 'create-booking')!.body;
  expect(reservation.language).toBe('en'); expect(reservation.slot_start).toBe(en.start);
  expect(reservation.customer.name).toBe('Jane Doe'); expect(reservation.whatsapp_consent).toBe(false);
});

for (const fail of [false, true]) test(`late ${fail ? 'error' : 'success'} cannot overwrite the latest language`, async ({ page }) => {
  const routes: Record<string, Route> = {};
  const calls = await setup(page, { 'get-availability': async (route) => { routes[route.request().postDataJSON().language] = route; } });
  await page.goto('/agendamento'); await expect.poll(() => Boolean(routes.pt)).toBe(true);
  await page.locator('[data-l="en"]').click(); await expect.poll(() => Boolean(routes.en)).toBe(true);
  await page.locator('[data-l="es"]').click(); await expect.poll(() => Boolean(routes.es)).toBe(true);
  const es = slot(2);
  await reply(routes.es, { slots: [es] });
  await expect(page.locator('.slot-opt')).toHaveCount(1);
  await reply(routes.en, fail ? { error: 'offline' } : { slots: [slot(1), slot(1)] }, fail ? 500 : 200);
  await reply(routes.pt, { slots: [slot(), slot()] });
  await selectAndFill(page); await page.locator('[data-book-pay]').click();
  await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test_fake');
  const reservation = calls.find((c) => c.endpoint === 'create-booking')!.body;
  expect(reservation.language).toBe('es'); expect(reservation.slot_start).toBe(es.start);
});

for (const result of [{ slots: [] }, { error: 'offline' }, { slots: [{ start: 'invalid', end: 'invalid' }] }]) test(`empty/error/malformed availability can recover after language change: ${JSON.stringify(result)}`, async ({ page }) => {
  await setup(page, { 'get-availability': (route) => route.request().postDataJSON().language === 'pt' ? reply(route, result, 'error' in result ? 500 : 200) : reply(route, { slots: [slot()] }) });
  await page.goto('/agendamento');
  await expect(page.locator('[data-slots]')).toHaveAttribute('aria-busy', 'false');
  const empty = 'slots' in result && result.slots?.length === 0;
  await expect(page.locator(empty ? '[data-slots-fallback]' : '[data-slots-retry]')).toBeVisible();
  await expect(page.locator('[data-book-details]')).toBeHidden();
  await page.locator('[data-l="en"]').click(); await expect(page.locator('.slot-opt')).toHaveCount(1);
  await expect(page.locator('[data-slots-fallback]')).toBeHidden();
  await expect(page.locator('[data-slots-retry]')).toBeHidden();
});

test('availability retry recovers a network failure', async ({ page }) => {
  let count = 0;
  await setup(page, { 'get-availability': (route) => ++count === 1 ? route.abort() : reply(route, { slots: [slot()] }) });
  await page.goto('/agendamento'); await page.locator('[data-slots-retry]').click();
  await expect(page.locator('.slot-opt')).toHaveCount(1);
});

for (const [field, value] of [['name', '  '], ['email', 'wrong'], ['phone', '123']]) test(`invalid customer ${field} never creates a reservation or checkout`, async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/agendamento'); await selectAndFill(page);
  await page.locator(`[data-b-${field}]`).fill(value); await page.locator('[data-book-pay]').click();
  expect(calls.filter((c) => c.endpoint !== 'get-availability')).toHaveLength(0);
  await expect(page.locator('[data-book-pay]')).toBeEnabled();
  expect(await page.locator(`[data-b-${field}]`).evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
});

test('WhatsApp consent requires a phone but remains optional', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/agendamento'); await selectAndFill(page); await page.locator('[data-b-phone]').fill('');
  await page.locator('[data-b-wa]').check(); await page.locator('[data-book-pay]').click();
  expect(calls.filter((c) => c.endpoint !== 'get-availability')).toHaveLength(0);
  await page.locator('[data-b-wa]').uncheck(); await page.locator('[data-book-pay]').click();
  await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test_fake');
});

test('duplicate submits and changes are blocked during reservation; checkout retries reuse the id', async ({ page }) => {
  let pending: Route | undefined;
  let attempts = 0;
  const calls = await setup(page, {
    'create-booking': async (route) => { pending = route; },
    'create-checkout-session': (route) => ++attempts === 1 ? reply(route, { error: 'provider_down' }, 500) : reply(route, { url: 'https://checkout.stripe.com/c/pay/cs_test_fake' }),
  });
  await page.goto('/agendamento'); await selectAndFill(page); await page.locator('[data-book-pay]').click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(page.locator('[data-book-pay]')).toBeDisabled();
  await expect(page.locator('[data-l="en"]')).toBeDisabled();
  await expect(page.locator('[data-b-name]')).toBeDisabled();
  await page.locator('[data-book-details]').evaluate((form: HTMLFormElement) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(calls.filter((c) => c.endpoint === 'create-booking')).toHaveLength(1);
  await reply(pending!, { booking_id: 'booking-test', amount: 80 });
  await expect(page.locator('[data-book-error]')).toContainText('A pré-reserva foi criada');
  await page.locator('[data-book-pay]').click(); await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test_fake');
  expect(calls.filter((c) => c.endpoint === 'create-booking')).toHaveLength(1);
  expect(calls.filter((c) => c.endpoint === 'create-checkout-session').map((c) => c.body.booking_id)).toEqual(['booking-test', 'booking-test']);
});

for (const mode of ['network', 'malformed', 'http500']) test(`uncertain reservation ${mode} prevents checkout and a duplicate reservation`, async ({ page }) => {
  const calls = await setup(page, { 'create-booking': (route) => mode === 'network' ? route.abort() : reply(route, mode === 'malformed' ? {} : { error: 'internal_error' }, mode === 'http500' ? 500 : 200) });
  await page.goto('/agendamento'); await selectAndFill(page); await page.locator('[data-book-pay]').click();
  await expect(page.locator('[data-book-error]')).toContainText('antes de tentar novamente');
  await expect(page.locator('[data-book-pay]')).toBeDisabled();
  expect(calls.some((c) => c.endpoint === 'create-checkout-session')).toBe(false);
});

test('server rejection allows correction and retry without checkout', async ({ page }) => {
  const calls = await setup(page, { 'create-booking': (route) => reply(route, { error: 'invalid_email' }, 400) });
  await page.goto('/agendamento'); await selectAndFill(page); await page.locator('[data-book-pay]').click();
  await expect(page.locator('[data-book-error]')).toContainText('Não foi possível reservar');
  await expect(page.locator('[data-book-pay]')).toBeEnabled();
  await expect(page.locator('[data-b-email]')).toBeEnabled();
  expect(calls.some((c) => c.endpoint === 'create-checkout-session')).toBe(false);
});

test('slot conflict reloads availability and clears selection', async ({ page }) => {
  const calls = await setup(page, { 'create-booking': (route) => reply(route, { error: 'slot_taken' }, 409) });
  await page.goto('/agendamento'); await selectAndFill(page); await page.locator('[data-book-pay]').click();
  await expect(page.locator('[data-availability-status]')).toContainText('Escolha outro horário');
  await expect(page.locator('[data-book-details]')).toBeHidden();
  expect(calls.filter((c) => c.endpoint === 'get-availability')).toHaveLength(2);
  expect(calls.some((c) => c.endpoint === 'create-checkout-session')).toBe(false);
});
for (const url of [undefined, 'javascript:alert(1)', 'https://example.invalid/pay']) test(`invalid checkout URL never redirects: ${url}`, async ({ page }) => {
  const calls = await setup(page, { 'create-checkout-session': (route) => reply(route, { url }) });
  await page.goto('/agendamento'); await selectAndFill(page); await page.locator('[data-book-pay]').click();
  await expect(page.locator('[data-book-error]')).toContainText('A pré-reserva foi criada');
  await expect(page).toHaveURL(/agendamento/);
  expect(calls.filter((c) => c.endpoint === 'create-booking')).toHaveLength(1);
});

test('availability timeout exposes retry and clears loading', async ({ page }) => {
  await page.clock.install();
  await setup(page, { 'get-availability': async () => {} });
  await page.goto('/agendamento');
  await expect(page.locator('[data-slots]')).toHaveAttribute('aria-busy', 'true');
  await page.clock.fastForward(21000);
  await expect(page.locator('[data-slots-retry]')).toBeVisible();
  await expect(page.locator('[data-slots]')).toHaveAttribute('aria-busy', 'false');
});

test('a slot that expires before submit is discarded without reserving', async ({ page }) => {
  const near = { start: new Date(Date.now() + 60000).toISOString(), end: new Date(Date.now() + 60000 + 45 * 60000).toISOString() };
  await page.clock.install();
  let attempts = 0;
  const calls = await setup(page, { 'get-availability': (route) => reply(route, { slots: [++attempts === 1 ? near : slot()] }) });
  await page.goto('/agendamento'); await selectAndFill(page);
  await page.clock.fastForward(70000); await page.locator('[data-book-pay]').click();
  await expect(page.locator('[data-book-details]')).toBeHidden();
  expect(calls.some((c) => c.endpoint === 'create-booking')).toBe(false);
  expect(calls.filter((c) => c.endpoint === 'get-availability')).toHaveLength(2);
});
