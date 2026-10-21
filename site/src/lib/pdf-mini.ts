// Gerador mínimo de PDF (texto + cores), sem dependências: só o PDF do diagnóstico precisa disto,
// e uma biblioteca como jsPDF pesaria ~300 KB. É carregado por import() no clique em "Baixar".
// Usa a Helvetica padrão com WinAnsiEncoding (cobre os acentos do português).

const WIN: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
const enc = (s: string) => Array.from(s).map((ch) => { const c = ch.charCodeAt(0); if (WIN[ch]) return String.fromCharCode(WIN[ch]); return c < 256 ? ch : '?'; }).join('');
const esc = (s: string) => enc(s).replace(/[\\()]/g, (m) => '\\' + m);

/** Largura aproximada da Helvetica (em unidades de 1/1000 do tamanho), suficiente para quebrar linhas. */
function largura(s: string, size: number, bold = false) {
  let w = 0;
  for (const ch of s) w += /[il.,:;'!|]/.test(ch) ? 260 : /[mwMW]/.test(ch) ? 850 : /[A-Z]/.test(ch) ? 680 : ch === ' ' ? 280 : 540;
  return (w * size * (bold ? 1.06 : 1)) / 1000;
}
function quebra(texto: string, size: number, max: number, bold = false): string[] {
  const linhas: string[] = [];
  for (const par of texto.split('\n')) {
    let atual = '';
    for (const p of par.split(/\s+/)) {
      const t = atual ? `${atual} ${p}` : p;
      if (largura(t, size, bold) > max && atual) { linhas.push(atual); atual = p; } else atual = t;
    }
    linhas.push(atual);
  }
  return linhas;
}

type RGB = [number, number, number];
export interface Bloco { texto: string; size?: number; bold?: boolean; cor?: RGB; espaco?: number; circulo?: RGB; }

/** Monta um PDF A4 (uma ou mais páginas) com blocos de texto em sequência. */
export function gerarPdf(blocos: Bloco[], fundoTopo: RGB = [1 / 255, 32 / 255, 63 / 255]): Blob {
  const W = 595, H = 842, M = 56, max = W - 2 * M;
  const paginas: string[] = [];
  let ops = '', y = H - M;
  const novaPagina = (primeira: boolean) => {
    if (ops) paginas.push(ops);
    ops = primeira ? `${fundoTopo.join(' ')} rg 0 ${H - 8} ${W} 8 re f\n` : '';
    y = H - M;
  };
  novaPagina(true);
  for (const b of blocos) {
    const size = b.size ?? 11, lh = size * 1.4, x = b.circulo ? M + 22 : M;
    const linhas = quebra(b.texto, size, max - (x - M), b.bold);
    y -= b.espaco ?? 6;
    if (y - linhas.length * lh < M) novaPagina(false);
    if (b.circulo) { // bolinha do semáforo
      const cx = M + 8, cy = y - size * 0.35, r = 7, k = r * 0.5523;
      ops += `${b.circulo.join(' ')} rg ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c f\n`;
    }
    const cor = (b.cor ?? [0.18, 0.18, 0.18]).join(' ');
    for (const l of linhas) { y -= lh; ops += `BT ${cor} rg /${b.bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y + lh * 0.25} Td (${esc(l)}) Tj ET\n`; }
  }
  paginas.push(ops);

  // Objetos: 1 catálogo, 2 páginas, 3-4 fontes, depois (página, conteúdo) por página.
  const objs: string[] = [];
  const kids = paginas.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  paginas.forEach((c, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${c.length} >>\nstream\n${c}endstream`);
  });
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  // Cada caractere já está em 0–255 (WinAnsi): 1 caractere = 1 byte.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}
