/**
 * Minimal single-font PDF writer for the export summary. Text only, Helvetica,
 * A4 pages, no dependencies. Enough for five numbers and a decision list with
 * no contact details.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const LINE_HEIGHT = 16;

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export type PdfLine = { text: string; size?: number; bold?: boolean; gapBefore?: number };

export function buildPdf(lines: PdfLine[]): Blob {
  const pages: string[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of lines) {
    const size = line.size ?? 11;
    const advance = Math.max(LINE_HEIGHT, size * 1.4) + (line.gapBefore ?? 0);
    if (y - advance < MARGIN) {
      pages.push([]);
      y = PAGE_HEIGHT - MARGIN;
    }
    y -= advance;
    const font = line.bold ? '/F2' : '/F1';
    pages[pages.length - 1].push(`BT ${font} ${size} Tf ${MARGIN} ${y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`);
  }

  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesIndex = objects.length + 1;
  objects.push('');
  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = page.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${content} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[pagesIndex - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pagesIndex} 0 R >>`);

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([Buffer.from(out, 'latin1')], { type: 'application/pdf' });
}
