import { registerAs } from '@nestjs/config';

export type AiProviderId = 'groq' | 'gemini' | 'openai';

export type AiConfig = {
  /** Ordered preference, e.g. groq,gemini,openai */
  priority: AiProviderId[];
  geminiApiKey: string;
  /** Groq Cloud (free tier) — HopMed-style OpenAI-compatible API. */
  groqApiKey: string;
  groqBaseUrl: string;
  openaiApiKey: string;
  geminiModel: string;
  groqModel: string;
  openaiModel: string;
  /** HTTP timeout for external AI APIs (ms). */
  timeoutMs: number;
  /** Max characters sent per field (title/excerpt/content/text). */
  maxInputChars: number;
  /** Soft daily token budget per user (0 = unlimited). Exceeded → HTTP 429. */
  dailyTokenQuota: number;
  /** Throttle: max AI requests per TTL window. */
  rateLimit: number;
  /** Throttle window in milliseconds. */
  rateLimitTtlMs: number;
};

const DEFAULT_PRIORITY: AiProviderId[] = ['groq', 'gemini', 'openai'];

function parsePriority(raw: string | undefined): AiProviderId[] {
  if (!raw?.trim()) return [...DEFAULT_PRIORITY];
  const allowed = new Set<AiProviderId>(['groq', 'gemini', 'openai']);
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .map((s) => (s === 'grok' ? 'groq' : s))
    .filter((s): s is AiProviderId => allowed.has(s as AiProviderId));
  return parsed.length > 0 ? parsed : [...DEFAULT_PRIORITY];
}

export const aiConfigFactory = (): AiConfig => ({
  priority: parsePriority(process.env.AI_PROVIDER_PRIORITY),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqBaseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30_000),
  maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS ?? 12_000),
  dailyTokenQuota: Number(process.env.AI_DAILY_TOKEN_QUOTA ?? 100_000),
  rateLimit: Number(process.env.AI_RATE_LIMIT ?? 10),
  rateLimitTtlMs: Number(process.env.AI_RATE_LIMIT_TTL_MS ?? 60_000),
});

export default registerAs('ai', aiConfigFactory);
