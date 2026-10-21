// Testes do motor dos diagnósticos (regras de roteamento, termos proibidos, validação de WhatsApp).
// Rodar: npm run test:diagnosticos
import assert from 'node:assert/strict';
import { DIAGNOSTICOS } from '../src/data/diagnosticos';
import { avaliaResultado, proximaPergunta, perguntasVisiveis, normalizaWhatsapp, limpaRespostas } from '../src/lib/diagnostico';
const D = Object.fromEntries(DIAGNOSTICOS.map((d) => [d.slug, d]));
let n = 0;
const t = (nome: string, fn: () => void) => { fn(); n++; console.log('ok -', nome); };

// Integridade das configs
for (const d of DIAGNOSTICOS) {
  const ids = new Set(d.perguntas.map((p) => p.id));
  assert.equal(ids.size, d.perguntas.length, `ids duplicados em ${d.slug}`);
  const refs = (c: any): string[] => c ? ('all' in c ? c.all.flatMap(refs) : 'any' in c ? c.any.flatMap(refs) : [c.q]) : [];
  for (const r of d.regras) for (const q of refs(r.quando)) assert.ok(ids.has(q), `${d.slug}/${r.id} usa pergunta inexistente ${q}`);
  for (const p of d.perguntas) for (const q of refs(p.showIf)) assert.ok(ids.has(q), `${d.slug}/${p.id} showIf ${q}`);
  const texto = JSON.stringify(d).toLowerCase();
  for (const proibido of ['ilegal', 'deporta', 'expuls', 'você está irregular']) assert.ok(!texto.includes(proibido), `${d.slug} contém "${proibido}"`);
  assert.ok(!/€\s?\d+[,.]?\d*\s*(\/|por)\s*(mês|serviço)/.test(texto) || d.slug === 'visto', 'preço?');
}
t('configs íntegras e sem termos proibidos', () => {});

const sp = D['situacao-em-portugal'];
t('situação: título vence em 90 dias → renovação 🟡', () => {
  const a = avaliaResultado(sp, { chegada: '1_3', entrada: 'com_visto', titulo: 'valido', vencimento: 'ate_90', tempo_residencia: '1_3', nif_niss: 'ambos', trabalho: 'contrato', familiar: 'nao' });
  assert.equal(a.principal.servico, 'Renovação de residência'); assert.equal(a.principal.cor, 'amarelo'); assert.equal(a.temperatura, 'quente');
});
t('situação: 5+ anos → longa duração 🟢', () => {
  const a = avaliaResultado(sp, { titulo: 'valido', vencimento: 'mais_90', tempo_residencia: '5_mais', nif_niss: 'ambos', familiar: 'nao', entrada: 'com_visto' });
  assert.equal(a.principal.id, 'longa_duracao'); assert.equal(a.principal.cor, 'verde');
});
t('situação: sem visto + sem título → regresso 🔴 e também reagrupamento', () => {
  const a = avaliaResultado(sp, { entrada: 'sem_visto', titulo: 'nao', familiar: 'filhos', nif_niss: 'nenhum' });
  assert.equal(a.principal.id, 'regresso_reentrada'); assert.equal(a.principal.cor, 'vermelho');
  assert.deepEqual(a.tambem.map((x) => x.servico), ['Reagrupamento familiar', 'NIF e NISS']);
});
t('situação: visto sem agendamento AIMA → 🟡', () => {
  const r = { entrada: 'com_visto', titulo: 'nao' } as Record<string, string>;
  assert.ok(perguntasVisiveis(sp, r).some((p) => p.id === 'agendamento_aima'));
  const a = avaliaResultado(sp, { ...r, agendamento_aima: 'nao', familiar: 'nao', nif_niss: 'ambos' });
  assert.equal(a.principal.id, 'agendamento_aima');
});
t('situação: familiar com título válido → reagrupamento 🟢; sem título → 🟡', () => {
  assert.equal(avaliaResultado(sp, { titulo: 'valido', vencimento: 'mais_90', familiar: 'conjuge', nif_niss: 'ambos' }).principal.id, 'reagrupamento');
  assert.equal(avaliaResultado(sp, { titulo: 'em_andamento', entrada: 'nao_sei', familiar: 'conjuge', nif_niss: 'ambos' }).principal.id, 'reagrupamento_atencao');
});
t('situação: showIf e limpeza ao mudar resposta', () => {
  const r = limpaRespostas(sp, { titulo: 'nao', vencimento: 'ate_90' });
  assert.equal(r.vencimento, undefined);
  assert.equal(proximaPergunta(sp, {})!.id, 'chegada');
});

const cc = D['carta-de-conducao'];
t('carta UE → 🟢 reconhecida, frio', () => {
  const a = avaliaResultado(cc, { pais_carta: 'ue', residencia: 'titulo', validade: 'valida' });
  assert.equal(a.titulo, 'Sua carta já é reconhecida em Portugal'); assert.equal(a.temperatura, 'frio');
});
t('carta BR + residente → troca IMT 🟡 quente', () => {
  const a = avaliaResultado(cc, { pais_carta: 'brasil', residencia: 'titulo', validade: 'valida', categoria: 'b' });
  assert.equal(a.principal.id, 'troca_imt'); assert.equal(a.temperatura, 'quente');
});
t('carta vencida → 🔴', () => assert.equal(avaliaResultado(cc, { pais_carta: 'brasil', residencia: 'titulo', validade: 'vencida' }).principal.cor, 'vermelho'));

const vi = D['visto'];
t('visto: patrimônio → relocation + high ticket + quente', () => {
  const a = avaliaResultado(vi, { objetivo: 'remoto', tipo_renda: 'remoto_exterior', faixa_renda: '3500_mais', patrimonio: 'empresa', prazo: 'mais_12m' });
  assert.equal(a.principal.servico, 'Relocation empresarial'); assert.ok(a.highTicket); assert.equal(a.temperatura, 'quente');
  assert.ok(a.tambem.some((x) => x.id === 'd8'));
});
t('visto: D7, D8, D3, D4, reagrupamento', () => {
  assert.equal(avaliaResultado(vi, { objetivo: 'renda_passiva', tipo_renda: 'aposentadoria', faixa_renda: '2000_3500', patrimonio: 'nao' }).principal.id, 'd7');
  assert.equal(avaliaResultado(vi, { objetivo: 'remoto', tipo_renda: 'freelancer', faixa_renda: '2000_3500', patrimonio: 'nao' }).principal.id, 'd8');
  assert.equal(avaliaResultado(vi, { objetivo: 'emprego', formacao: 'sim', proposta: 'sim', tipo_renda: 'clt_brasil', patrimonio: 'nao' }).principal.id, 'd3');
  assert.equal(avaliaResultado(vi, { objetivo: 'estudar', tipo_renda: 'sem_renda', patrimonio: 'nao' }).principal.id, 'd4');
  assert.equal(avaliaResultado(vi, { objetivo: 'familia', tipo_renda: 'sem_renda', patrimonio: 'nao' }).principal.id, 'reagrupamento');
});
t('visto: sem perfil → 🟡 caminho não claro, frio (nutrição)', () => {
  const a = avaliaResultado(vi, { objetivo: 'empreender', tipo_renda: 'sem_renda', faixa_renda: 'ate_1000', formacao: 'nao', proposta: 'nao', patrimonio: 'nao', prazo: 'ate_3m' });
  assert.equal(a.titulo, 'Ainda não há um caminho claro'); assert.equal(a.temperatura, 'frio'); assert.equal(a.principal.cor, 'amarelo');
});

const np = D['nacionalidade-parada'];
t('nacionalidade parada: >2 anos → 🔴 ação; <2 → 🟡', () => {
  assert.equal(avaliaResultado(np, { data_pedido: 'mais_2', numero_processo: 'sim' }).titulo, 'Seu caso pode permitir ação');
  assert.equal(avaliaResultado(np, { data_pedido: '1_2', numero_processo: 'sim' }).principal.cor, 'amarelo');
});
t('rascunhos não publicados', () => { assert.equal(D['nacionalidade'].publicado, false); assert.equal(np.publicado, false); });
t('nacionalidade: nenhum prazo legal fixo em anos no texto público', () => {
  const nac = D['nacionalidade'];
  const txt = [nac.textos.a, nac.textos.b, ...nac.regras.map((r) => r.descricao), nac.semPerfil.descricao].map((x: any) => JSON.stringify(x)).join(' ');
  assert.ok(!/\d+\s*anos/.test(txt), txt.match(/\d+\s*anos/)?.[0]);
});

t('WhatsApp: validação por país', () => {
  assert.equal(normalizaWhatsapp('+351', '912 345 678'), '+351 912345678');
  assert.equal(normalizaWhatsapp('+351', '+351 912345678'), '+351 912345678');
  assert.equal(normalizaWhatsapp('+351', '212345678'), null);
  assert.equal(normalizaWhatsapp('+351', '91234567'), null);
  assert.equal(normalizaWhatsapp('+55', '(11) 91234-5678'), '+55 11912345678');
  assert.equal(normalizaWhatsapp('+55', '5511912345678'), '+55 11912345678');
  assert.equal(normalizaWhatsapp('+55', '011 91234-5678'), '+55 11912345678');
  assert.equal(normalizaWhatsapp('+55', '912345678'), null);
  assert.equal(normalizaWhatsapp('+44', '7700900123'), '+44 7700900123');
});
console.log(`\n${n} testes OK`);
