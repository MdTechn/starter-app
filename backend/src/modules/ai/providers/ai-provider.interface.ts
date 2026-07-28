export type AiProviderName = 'gemini' | 'groq' | 'openai';

export type AiTranslatePayload = {
  title: string;
  excerpt?: string | null;
  content: string;
  sourceLocale: string;
  targetLocale: string;
};

export type AiTranslateOutput = {
  title: string;
  excerpt: string | null;
  content: string;
  tokensUsed: number;
};

export type AiRewriteMode =
  'ameliorer' | 'professionnel' | 'court' | 'long' | 'seo' | 'corriger';

export type AiRewritePayload = {
  text: string;
  mode: AiRewriteMode;
};

export type AiRewriteOutput = {
  text: string;
  tokensUsed: number;
};

/**
 * Interchangeable AI backend. Controllers/services must depend on this
 * interface only — never on Gemini/Grok/OpenAI SDKs directly.
 */
export interface AIProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  translate(input: AiTranslatePayload): Promise<AiTranslateOutput>;
  rewrite(input: AiRewritePayload): Promise<AiRewriteOutput>;
}

export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
