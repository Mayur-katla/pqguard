const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with"
]);

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function words(text = ""): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_()[\]{}<>#]/g, " ")
    .split(/[^a-z0-9_./-]+/i)
    .map((word) => word.trim())
    .filter(Boolean);
}

export function uniqueMeaningfulWords(text = ""): Set<string> {
  return new Set(words(text).filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

export function sentences(text = ""): string[] {
  return text
    .split(/[.!?;\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function cosineLikeSimilarity(a: string, b: string): number {
  const left = uniqueMeaningfulWords(a);
  const right = uniqueMeaningfulWords(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const word of left) {
    if (right.has(word)) intersection += 1;
  }
  return intersection / Math.sqrt(left.size * right.size);
}

export function average(numbers: number[]): number {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
}

export function standardDeviation(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  const mean = average(numbers);
  const variance = average(numbers.map((item) => (item - mean) ** 2));
  return Math.sqrt(variance);
}

export function excerptAround(text: string, phrase: string, size = 150): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(phrase.toLowerCase());
  if (index < 0) return text.slice(0, size).trim();
  const start = Math.max(0, index - Math.floor(size / 2));
  const end = Math.min(text.length, index + phrase.length + Math.floor(size / 2));
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
