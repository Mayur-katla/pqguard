function textFromItem(item: unknown) {
  if (typeof item !== "object" || item === null || !("str" in item)) return "";
  const value = (item as { str: unknown }).str;
  return typeof value === "string" ? value.trim() : "";
}

export async function extractPdfText(bytes: Buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({
    data: new Uint8Array(bytes)
  }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(textFromItem)
      .filter(Boolean)
      .join(" ");
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}
