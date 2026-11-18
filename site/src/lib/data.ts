import { supabase } from './supabase';
import { fallbackOffices, fallbackTeam, fallbackServices } from './fallback';

export interface Office {
  id?: string;
  slug: string;
  name: string;
  address: string;
  whatsapp: string;
  lat: number | null;
  lng: number | null;
  maps_url: string;
  opening_date: string | null;
  hero_photo: string;
  coordinator_code: string;
  coordinator_name?: string;
  coordinator_role?: string;
  hours: Record<string, string>;
  is_open: boolean;
  intro?: string;
  phone?: string;
  email?: string;
}

export interface TeamMember {
  code: string;
  name: string;
  role_label: string;
  unit: string;
  photo_url: string;
  founder?: boolean;
}

export interface Service {
  code: string;
  name: string;
  name_en?: string;
  name_es?: string;
  category: string;
  family: string;
  price: number | null;
  price_obs?: string;
  price_label?: string;
  requires_consultation?: boolean;
  action?: 'add' | 'book';
}

const isEmpty = (a: unknown) => !Array.isArray(a) || a.length === 0;

/** Unidades ativas, ordenadas. Cai no fallback se não houver Supabase/dados. */
let officesCache: Promise<Office[]> | undefined;
export function getOffices(): Promise<Office[]> {
  // Uma consulta por build: os botões do WhatsApp pedem as unidades em todas as páginas.
  return (officesCache ??= loadOffices());
}

async function loadOffices(): Promise<Office[]> {
  if (!supabase) return fallbackOffices;
  try {
    const { data, error } = await supabase
      .from('offices')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error || isEmpty(data)) return fallbackOffices;
    return (data as any[]).map((o) => ({
      ...o,
      slug: o.slug ?? slugify(o.name),
      hours: o.hours ?? {},
      is_open: o.is_open ?? true,
      whatsapp: o.whatsapp ?? '',
      maps_url: o.maps_url ?? '',
    })) as Office[];
  } catch {
    return fallbackOffices;
  }
}

export async function getOfficeBySlug(slug: string): Promise<Office | undefined> {
  const all = await getOffices();
  return all.find((o) => o.slug === slug);
}

/** Equipe pública (tabela própria do site). Fallback p/ lista local. */
export async function getTeam(): Promise<TeamMember[]> {
  if (!supabase) return fallbackTeam;
  try {
    const { data, error } = await supabase
      .from('team')
      .select('code,name,role_label,unit,photo_url,founder')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error || isEmpty(data)) return fallbackTeam;
    return data as TeamMember[];
  } catch {
    return fallbackTeam;
  }
}

/** Catálogo de serviços público do site. */
export async function getServices(limit?: number): Promise<Service[]> {
  if (!supabase) return limit ? fallbackServices.slice(0, limit) : fallbackServices;
  try {
    let q = supabase
      .from('services')
      .select('code,name,name_en,name_es,category,family,price,price_obs,price_label,requires_consultation,action')
      .eq('status', 'active')
      .order('sort_order', { ascending: true });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error || isEmpty(data)) return limit ? fallbackServices.slice(0, limit) : fallbackServices;
    return data as Service[];
  } catch {
    return limit ? fallbackServices.slice(0, limit) : fallbackServices;
  }
}

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
