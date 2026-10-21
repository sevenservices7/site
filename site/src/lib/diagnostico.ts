// Motor dos quizzes de diagnóstico: funções puras, usadas no navegador (DiagnosticQuiz.astro)
// e nos testes. Não conhece HTML nem rede.
import type { Condicao, Cor, Diagnostico, Pergunta, Resultado, Temperatura } from '../data/diagnosticos/types';

export type Respostas = Record<string, string>;

export function avalia(c: Condicao | undefined, r: Respostas): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => avalia(x, r));
  if ('any' in c) return c.any.some((x) => avalia(x, r));
  const v = r[c.q];
  if ('in' in c) return v !== undefined && c.in.includes(v);
  return v === undefined || !c.notIn.includes(v);
}

/** Perguntas visíveis com as respostas atuais (respeita showIf). */
export function perguntasVisiveis(d: Diagnostico, r: Respostas): Pergunta[] {
  return d.perguntas.filter((p) => avalia(p.showIf, r));
}

/** Próxima pergunta ainda sem resposta, ou null quando o quiz terminou. */
export function proximaPergunta(d: Diagnostico, r: Respostas): Pergunta | null {
  return perguntasVisiveis(d, r).find((p) => r[p.id] === undefined) ?? null;
}

/** Remove respostas de perguntas que deixaram de estar visíveis (quando a pessoa volta e muda). */
export function limpaRespostas(d: Diagnostico, r: Respostas): Respostas {
  const vis = new Set(perguntasVisiveis(d, r).map((p) => p.id));
  return Object.fromEntries(Object.entries(r).filter(([k]) => vis.has(k)));
}

export const TITULO_COR: Record<Cor, string> = {
  verde: 'Seu caso tem caminho simples',
  amarelo: 'Seu caso tem pontos de atenção',
  vermelho: 'Seu caso precisa de ação prioritária',
};
export const EMOJI_COR: Record<Cor, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };

export interface Avaliacao {
  principal: Resultado;
  titulo: string;
  /** Outros serviços que também se aplicam (sem repetir o principal). */
  tambem: Resultado[];
  temperatura: Temperatura;
  highTicket: boolean;
  pontos: number;
}

export function avaliaResultado(d: Diagnostico, r: Respostas): Avaliacao {
  const aplicaveis = d.regras.filter((x) => avalia(x.quando, r)).sort((a, b) => b.prioridade - a.prioridade);
  const principal: Resultado = aplicaveis[0] ?? d.semPerfil;
  const vistos = new Set([principal.servico]);
  const tambem = aplicaveis.slice(1).filter((x) => (vistos.has(x.servico) ? false : (vistos.add(x.servico), true)));
  const highTicket = d.highTicket ? avalia(d.highTicket, r) : false;
  let pontos = d.temperatura.porCor[principal.cor] ?? 0;
  for (const p of d.temperatura.pontos) if (avalia(p.quando, r)) pontos += p.pontos;
  const temperatura: Temperatura = principal.temperatura ?? (highTicket || pontos >= d.temperatura.quenteAPartirDe ? 'quente' : 'frio');
  return { principal, titulo: principal.titulo ?? TITULO_COR[principal.cor], tambem, temperatura, highTicket, pontos };
}

/** Respostas em texto legível ("Pergunta: Resposta"), para o CRM e para o PDF. */
export function resumoRespostas(d: Diagnostico, r: Respostas): { pergunta: string; resposta: string }[] {
  return perguntasVisiveis(d, r)
    .filter((p) => r[p.id] !== undefined)
    .map((p) => ({ pergunta: p.texto, resposta: p.opcoes.find((o) => o.valor === r[p.id])?.texto ?? r[p.id] }));
}

/** Dígitos esperados do número nacional por DDI (sem o DDI). Outros países: 6 a 15. */
const TAMANHO: Record<string, [number, number]> = { '+351': [9, 9], '+55': [10, 11] };

/**
 * Normaliza e valida um WhatsApp. Aceita o número com ou sem o DDI repetido, espaços e zeros à esquerda.
 * Devolve "+55 11999998888" ou null quando o formato não bate.
 */
export function normalizaWhatsapp(ddi: string, numero: string): string | null {
  const cc = ddi.replace(/\D/g, '');
  let n = numero.replace(/\D/g, '');
  const [min, max] = TAMANHO[`+${cc}`] ?? [6, 15];
  if (n.startsWith('00' + cc)) n = n.slice(2 + cc.length);
  else if (n.startsWith(cc) && n.length > max) n = n.slice(cc.length);
  if (cc === '55') n = n.replace(/^0+/, ''); // "011 9..." → "11 9..."
  if (n.length < min || n.length > max) return null;
  if (cc === '351' && !/^9/.test(n)) return null; // WhatsApp em Portugal: telemóvel começa por 9
  return `+${cc} ${n}`;
}
