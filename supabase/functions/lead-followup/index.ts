import { adminClient, SITE_URL } from '../_shared/clients.ts';
import { sendEmail } from '../_shared/email.ts';
import { esc } from '../_shared/lead-copy.ts';
import { createKommoLead } from '../_shared/kommo.ts';

// Chamado pelo pg_cron a cada 10 minutos. Para quem começou o formulário "Falar com especialista",
// autorizou contato e não terminou em 30 minutos, envia UM e-mail convidando a contar o caso.
const DELAY_MIN = 30;
const PATHS: Record<string, string> = { pt: '/falar-com-especialista', en: '/en/talk-to-an-expert', es: '/es/hablar-con-un-especialista', fr: '/fr/parler-a-un-specialiste' };
const COPY: Record<string, { subject: string; hi: string; body: string[]; cta: string; sign: string }> = {
  pt: { subject: 'Vi que você começou a falar com a gente', hi: 'Olá', body: ['Vi que você começou a preencher o nosso formulário, mas não conseguiu finalizar.', 'Qual é o problema que você quer resolver? Pode responder este e-mail com duas linhas sobre o seu caso, ou terminar o formulário pelo botão abaixo. A gente analisa e mostra o caminho.'], cta: 'Continuar de onde parei', sign: 'Equipe SEVEN · Sempre existe um caminho.' },
  en: { subject: 'I saw you started getting in touch', hi: 'Hello', body: ['I noticed you started filling in our form but didn’t get to finish it.', 'What problem would you like to solve? You can reply to this email with a couple of lines about your case, or finish the form using the button below. We’ll look at it and show you the way.'], cta: 'Continue where I left off', sign: 'The SEVEN team · There is always a way.' },
  es: { subject: 'Vi que empezaste a contactarnos', hi: 'Hola', body: ['Vi que empezaste a completar nuestro formulario, pero no llegaste a terminarlo.', '¿Qué problema quieres resolver? Puedes responder a este correo con dos líneas sobre tu caso o terminar el formulario con el botón de abajo. Lo analizamos y te mostramos el camino.'], cta: 'Continuar donde lo dejé', sign: 'Equipo SEVEN · Siempre hay un camino.' },
  fr: { subject: 'Vous avez commencé à nous contacter', hi: 'Bonjour', body: ['J’ai vu que vous aviez commencé à remplir notre formulaire sans pouvoir le terminer.', 'Quel problème souhaitez-vous résoudre ? Vous pouvez répondre à cet e-mail en deux lignes sur votre situation, ou terminer le formulaire avec le bouton ci-dessous. Nous l’analysons et vous montrons le chemin.'], cta: 'Reprendre là où je me suis arrêté', sign: 'L’équipe SEVEN · Il y a toujours un chemin.' },
};

function html(lang: string, name: string, link: string): string {
  const c = COPY[lang] ?? COPY.pt;
  const first = esc(name.split(/\s+/)[0] || '');
  return `<div style="font:16px/1.6 Arial,sans-serif;color:#01203F;max-width:560px">
<p>${c.hi}${first ? `, ${first}` : ''}!</p>${c.body.map((p) => `<p>${esc(p)}</p>`).join('')}
<p style="margin:28px 0"><a href="${link}" style="background:#D6C496;color:#01203F;padding:12px 22px;text-decoration:none;font-weight:bold;display:inline-block">${esc(c.cta)}</a></p>
<p style="color:#5b6b7f">${esc(c.sign)}</p></div>`;
}

Deno.serve(async (req) => {
  // Chamada sem efeito colateral fora do previsto: só envia a leads elegíveis (30+ min, uma vez cada).
  // Se CRON_SECRET existir, exige o cabeçalho.
  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  const sb = adminClient();
  const now = Date.now();
  const { data: leads, error } = await sb.from('leads').select('id,name,email,token,site_lang')
    .eq('status', 'partial').eq('email_consent', true).is('followup_sent_at', null)
    .lt('created_at', new Date(now - DELAY_MIN * 60000).toISOString())
    .gt('created_at', new Date(now - 7 * 864e5).toISOString()).limit(50);
  if (error) { console.error('followup', error); return new Response('error', { status: 500 }); }
  const from = Deno.env.get('FOLLOWUP_FROM') || 'SEVEN <contato@sevenservicess.com>';
  const replyTo = Deno.env.get('LEAD_REPLY_TO') || Deno.env.get('LEAD_NOTIFY_EMAIL') || 'contato@seveneu.com';
  let sent = 0;
  for (const l of leads ?? []) {
    const lang = COPY[l.site_lang] ? l.site_lang : 'pt';
    const link = `${SITE_URL}${PATHS[lang]}?lead=${l.id}&t=${l.token}`;
    const ok = await sendEmail(l.email, COPY[lang].subject, html(lang, l.name, link), { from, replyTo });
    if (ok) { await sb.from('leads').update({ followup_sent_at: new Date().toISOString() }).eq('id', l.id); sent++; }
  }
  // Quem parou antes do WhatsApp ainda não tem lead no Kommo (que deduplica pelo telefone): cria só com o e-mail.
  const { data: noPhone } = await sb.from('leads').select('id,name,email,language,whatsapp_consent')
    .eq('status', 'partial').is('phone', null).is('kommo_lead_id', null).is('kommo_error', null)
    .lt('created_at', new Date(now - DELAY_MIN * 60000).toISOString()).limit(20);
  for (const l of noPhone ?? []) {
    try {
      const { lead_id } = await createKommoLead({ name: l.name, email: l.email, phone: '', language: l.language, source: 'website-prequal', whatsapp_consent: l.whatsapp_consent === true });
      await sb.from('leads').update(lead_id ? { kommo_lead_id: lead_id } : { kommo_error: 'sem id' }).eq('id', l.id);
    } catch (e) { await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', l.id); }
  }
  return new Response(JSON.stringify({ candidates: leads?.length ?? 0, sent, resend: Boolean(Deno.env.get('RESEND_API_KEY')) }), { headers: { 'Content-Type': 'application/json' } });
});
