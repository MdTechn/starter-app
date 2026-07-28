/** Shared helpers for AI HTTP providers (timeout, truncation, JSON parse). */

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[…truncated for AI cost limit]`;
}

export function estimateTokens(text: string): number {
  // Rough heuristic (~4 chars/token) when provider omits usage.
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('AI response did not contain a JSON object');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

export const REWRITE_MODE_PROMPTS: Record<string, string> = {
  ameliorer:
    'Improve clarity, flow and style while preserving meaning and language.',
  professionnel:
    'Rewrite in a professional, polished tone suitable for business content.',
  court: 'Rewrite more concisely. Cut fluff; keep essential meaning.',
  long: 'Expand with useful detail and richer phrasing without inventing facts.',
  seo: 'Rewrite for SEO: clear headings cues, natural keywords, readable paragraphs. Keep the language.',
  corriger:
    'Fix grammar, spelling and punctuation only. Do not change meaning or style.',
};
