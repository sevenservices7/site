import { ApiError, getAvailability, createBooking, createBookingCheckout } from './api';
import { customerError, isConsultationLanguage, normalizeCustomer, validSlot, type BookingSlot } from '../../../supabase/functions/_shared/booking';

export function initBooking(root: HTMLElement) {
  const locale = root.dataset.lang || 'pt';
  let language = isConsultationLanguage(root.dataset.consult) ? root.dataset.consult : 'pt';
  let selected: BookingSlot | null = null;
  let availabilityLanguage: string | null = null;
  let request = 0;
  let loading = false;
  let submitting = false;
  let bookingId: string | null = null;
  let uncertain = false;
  const slots = root.querySelector<HTMLElement>('[data-slots]')!;
  const fallback = root.querySelector<HTMLElement>('[data-slots-fallback]')!;
  const availabilityStatus = root.querySelector<HTMLElement>('[data-availability-status]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-slots-retry]')!;
  const details = root.querySelector<HTMLFormElement>('[data-book-details]')!;
  const error = root.querySelector<HTMLElement>('[data-book-error]')!;
  const pay = root.querySelector<HTMLButtonElement>('[data-book-pay]')!;
  const name = root.querySelector<HTMLInputElement>('[data-b-name]')!;
  const email = root.querySelector<HTMLInputElement>('[data-b-email]')!;
  const phone = root.querySelector<HTMLInputElement>('[data-b-phone]')!;
  const consent = root.querySelector<HTMLInputElement>('[data-b-wa]')!;
  const message = (key: string) => root.dataset[key] || '';
  const locked = () => submitting || Boolean(bookingId) || uncertain;

  function controls() {
    root.querySelectorAll<HTMLButtonElement>('[data-book-langs] button, .slot-opt').forEach((button) => button.disabled = locked());
    details.querySelectorAll<HTMLInputElement>('input').forEach((input) => input.disabled = locked());
    pay.disabled = submitting || uncertain || loading || !selected || availabilityLanguage !== language;
    pay.textContent = message(submitting ? 'processing' : bookingId ? 'retryCheckout' : 'book');
    details.setAttribute('aria-busy', String(submitting));
  }

  async function loadSlots() {
    if (locked()) return;
    const currentRequest = ++request;
    const requestedLanguage = language;
    selected = null;
    availabilityLanguage = null;
    loading = true;
    details.hidden = true;
    slots.replaceChildren();
    slots.hidden = false;
    slots.setAttribute('aria-busy', 'true');
    fallback.hidden = true;
    retry.hidden = true;
    availabilityStatus.textContent = message('loading');
    controls();
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.parse(from) + 14 * 864e5).toISOString();
      const result = await getAvailability({ from, to, language: requestedLanguage });
      if (currentRequest !== request) return;
      // A malformed response is a failure, not an empty calendar.
      if (!Array.isArray(result?.slots) || result.slots.some((slot) => !validSlot(slot))) throw new Error('invalid_availability');
      availabilityLanguage = requestedLanguage;
      availabilityStatus.textContent = '';
      fallback.hidden = result.slots.length !== 0;
      result.slots.slice(0, 24).forEach((slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'slot-opt';
        button.setAttribute('aria-pressed', 'false');
        button.textContent = new Date(slot.start).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        button.addEventListener('click', () => {
          if (locked() || loading || availabilityLanguage !== language || !validSlot(slot)) return;
          selected = slot;
          slots.querySelectorAll('.slot-opt').forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
          error.textContent = '';
          details.hidden = false;
          controls();
        });
        slots.appendChild(button);
      });
    } catch {
      if (currentRequest !== request) return;
      availabilityStatus.textContent = message('availabilityError');
      retry.hidden = false;
    } finally {
      if (currentRequest === request) {
        loading = false;
        slots.setAttribute('aria-busy', 'false');
        controls();
      }
    }
  }

  root.querySelectorAll<HTMLButtonElement>('[data-book-langs] button').forEach((button) => {
    button.addEventListener('click', () => {
      if (locked() || !isConsultationLanguage(button.dataset.l) || button.dataset.l === language) return;
      language = button.dataset.l;
      error.textContent = '';
      root.querySelectorAll('[data-book-langs] button').forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
      void loadSlots();
    });
  });
  retry.addEventListener('click', () => void loadSlots());
  [name, email, phone, consent].forEach((input) => input.addEventListener('input', () => {
    [name, email, phone].forEach((field) => field.setCustomValidity(''));
  }));

  details.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || uncertain || loading || !selected || availabilityLanguage !== language) return;
    if (!bookingId) {
      if (!validSlot(selected)) {
        await loadSlots();
        availabilityStatus.textContent = message('slotTaken');
        return;
      }
      const customer = normalizeCustomer({ name: name.value, email: email.value, phone: phone.value });
      name.value = customer.name;
      email.value = customer.email;
      phone.value = customer.phone || '';
      const invalid = customerError(customer, consent.checked);
      if (invalid) {
        const field = invalid === 'invalid_name' ? name : invalid === 'invalid_email' ? email : phone;
        field.setCustomValidity(message('invalidDetails'));
      }
      if (!details.reportValidity()) return;
    }
    // Freeze the exact language/slot/customer snapshot until checkout completes.
    submitting = true;
    error.textContent = '';
    controls();
    let creating = !bookingId;
    try {
      if (!bookingId) {
        const result = await createBooking({
          language, service_code: 'CONSULT', slot_start: selected.start, slot_end: selected.end,
          whatsapp_consent: consent.checked,
          customer: normalizeCustomer({ name: name.value, email: email.value, phone: phone.value }),
        });
        bookingId = result.booking_id;
      }
      creating = false;
      const { url } = await createBookingCheckout(bookingId, language);
      window.location.assign(url);
    } catch (failure) {
      if (creating && failure instanceof ApiError && failure.code === 'slot_taken') {
        submitting = false;
        await loadSlots();
        availabilityStatus.textContent = message('slotTaken');
      } else if (creating) {
        // A lost response may have persisted a reservation. Do not blindly duplicate it.
        uncertain = !(failure instanceof ApiError && failure.status >= 400 && failure.status < 500);
        error.textContent = message(uncertain ? 'bookingUncertain' : 'bookingError');
      } else {
        // Keep the confirmed booking id and retry only checkout.
        error.textContent = message('checkoutError');
      }
    } finally {
      submitting = false;
      controls();
    }
  });
  void loadSlots();
}
