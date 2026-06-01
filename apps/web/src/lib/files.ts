import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

const textLikeExtensions = new Set(["txt", "md", "markdown", "csv", "json", "log", "yml", "yaml"]);

function extensionFor(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function textFromItem(item: unknown) {
  if (typeof item !== "object" || item === null || !("str" in item)) return "";
  const value = (item as { str: unknown }).str;
  return typeof value === "string" ? value.trim() : "";
}

async function loadPdf(bytes: Uint8Array) {
  const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  return getDocument({ data: bytes }).promise;
}

async function extractPdfText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await loadPdf(bytes);
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

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("This PDF has no selectable text. It may be scanned or image-only. Upload a text-based PDF, TXT, or MD file, or paste the resume text.");
  }

  return text;
}

export async function extractUploadText(file: File) {
  const extension = extensionFor(file);

  if (extension === "pdf" || file.type === "application/pdf") {
    return extractPdfText(file);
  }

  if (["doc", "docx"].includes(extension)) {
    throw new Error("DOC/DOCX parsing is not built in yet. Export to PDF, TXT, or MD and upload again.");
  }

  if (!textLikeExtensions.has(extension)) {
    throw new Error("Upload a PDF, TXT, MD, CSV, JSON, YAML, or LOG file.");
  }

  return file.text();
}
