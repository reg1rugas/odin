// Small text report writer. Byte offsets are calculated after ASCII normalization.
export function makePdf(title: string, lines: string[]) {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  const wrap = (s: string) => {
    const out: string[] = [];
    for (const line of s.split("\n")) {
      let rest = line;
      while (rest.length > 92) {
        let at = rest.lastIndexOf(" ", 92);
        if (at < 20) at = 92;
        out.push(rest.slice(0, at));
        rest = rest.slice(at).trim();
      }
      out.push(rest);
    }
    return out;
  };
  const all = [
    title,
    "ODIN / VISUAL INTELLIGENCE",
    `Generated ${new Date().toISOString()}`,
    "",
    ...lines.flatMap(wrap),
  ];
  const pages: string[][] = [];
  for (let i = 0; i < all.length; i += 48) pages.push(all.slice(i, i + 48));
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects.push(
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  pages.forEach((page, i) => {
    const content = `BT /F1 10 Tf 48 790 Td 15 TL ${page.map((s, j) => `${j ? "T* " : ""}(${clean(s)}) Tj`).join("\n")}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((x) => String(x).padStart(10, "0") + " 00000 n \n")
      .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
