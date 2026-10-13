export const consultationLanguages = ['pt', 'en', 'es'] as const;
export type ConsultationLanguage = typeof consultationLanguages[number];
export interface BookingSlot { start: string; end: string; }
export interface BookingCustomer { name: string; email: string; phone?: string; }

export function isConsultationLanguage(value: unknown): value is ConsultationLanguage {
  return consultationLanguages.some((language) => language === value);
}

export function validSlot(slot: BookingSlot, now = Date.now()): boolean {
  // Explicit offsets avoid interpreting an unzoned date in the browser/server timezone.
  const zoned = /T.*(?:Z|[+-]\d{2}:\d{2})$/;
  if (typeof slot?.start !== 'string' || typeof slot?.end !== 'string' || !zoned.test(slot.start) || !zoned.test(slot.end)) return false;
  const start = Date.parse(slot.start), end = Date.parse(slot.end);
  return Number.isFinite(start) && Number.isFinite(end) && start > now && end > start;
}

export function normalizeCustomer(customer: BookingCustomer): BookingCustomer {
  return { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone?.trim() || '' };
}

export function customerError(customer: unknown, whatsappConsent = false): string | null {
  if (!customer || typeof customer !== 'object') return 'invalid_customer';
  const { name, email, phone } = customer as BookingCustomer;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 200) return 'invalid_name';
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'invalid_email';
  if (phone != null && typeof phone !== 'string') return 'invalid_phone';
  const value = phone?.trim() || '';
  if (whatsappConsent && !value) return 'invalid_phone';
  if (value && (value.length > 40 || !/^\+?[\d\s().-]+$/.test(value) || value.replace(/\D/g, '').length < 7 || value.replace(/\D/g, '').length > 15)) return 'invalid_phone';
  return null;
}

export function bookingInputError(body: any, now = Date.now(), slotMinutes = 45): string | null {
  if (!body || !isConsultationLanguage(body.language)) return 'invalid_language';
  if (!validSlot({ start: body.slot_start, end: body.slot_end }, now)) return 'invalid_slot';
  if (Date.parse(body.slot_end) - Date.parse(body.slot_start) !== slotMinutes * 60000) return 'invalid_slot_duration';
  return customerError(body.customer, body.whatsapp_consent === true);
}
