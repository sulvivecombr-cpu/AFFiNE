/**
 * Document text extraction. PDF goes through pdfjs (pure JS, no native build),
 * plain text and Markdown are read directly. Every page keeps its number so the
 * parsed topics can point back to the page they came from.
 */
export async function extractPages({ buffer, mime }) {
  if (mime === 'application/pdf') {
    return extractPdf(buffer);
  }
  if (mime === 'text/plain' || mime === 'text/markdown') {
    const text = buffer.toString('utf8');
    const chunks = text.split('\f');
    return chunks.map((chunk, index) => ({ pageNo: index + 1, text: chunk }));
  }
  throw new Error(`Formato não suportado para extração: ${mime}`);
}

async function extractPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const pages = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const lines = [];
    let current = '';
    let lastY = null;
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;
      const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        lines.push(current);
        current = '';
      }
      current += item.str;
      if (item.hasEOL) {
        lines.push(current);
        current = '';
        lastY = null;
        continue;
      }
      lastY = y;
    }
    if (current.trim()) lines.push(current);
    pages.push({ pageNo, text: lines.join('\n') });
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}
