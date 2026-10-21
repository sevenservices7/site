// Registro das landing pages de diagnóstico. Para criar uma LP nova: um arquivo nesta pasta + uma linha aqui.
import type { Diagnostico } from './types';
import { situacaoEmPortugal } from './situacao-em-portugal';
import { cartaDeConducao } from './carta-de-conducao';
import { visto } from './visto';
import { nacionalidade } from './nacionalidade';
import { nacionalidadeParada } from './nacionalidade-parada';

export const DIAGNOSTICOS: Diagnostico[] = [situacaoEmPortugal, cartaDeConducao, visto, nacionalidade, nacionalidadeParada];

/**
 * LPs geradas no build. Rascunhos (publicado: false) só entram em `npm run dev`
 * ou com PUBLIC_DIAG_PREVIEW=true — em produção não existem (404).
 */
export function diagnosticosNoBuild(preview: boolean): Diagnostico[] {
  return DIAGNOSTICOS.filter((d) => d.publicado || preview);
}
