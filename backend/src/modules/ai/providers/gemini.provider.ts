import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../../../config/ai.config';
import {
  AIProvider,
  AiProviderName,
  AiRewriteOutput,
  AiRewritePayload,
  AiTranslateOutput,
  AiTranslatePayload,
} from './ai-provider.interface';
import {
  REWRITE_MODE_PROMPTS,
  estimateTokens,
  extractJsonObject,
  fetchWithTimeout,
  truncateText,
} from './ai-http.util';

@Injectable()
export class GeminiProvider implements AIProvider {
  readonly name: AiProviderName = 'gemini';

  constructor(private readonly config: ConfigService) {}

  private cfg(): AiConfig {
    return this.config.get<AiConfig>('ai')!;
  }

  isConfigured(): boolean {
    return Boolean(this.cfg().geminiApiKey?.trim());
  }

  async translate(input: AiTranslatePayload): Promise<AiTranslateOutput> {
    const ai = this.cfg();
    const max = ai.maxInputChars;
    const prompt = [
      `Translate the following CMS article from ${input.sourceLocale} to ${input.targetLocale}.`,
      'Preserve HTML/markdown structure if present. Do not add commentary.',
      'Return ONLY a JSON object: {"title":"...","excerpt":"...","content":"..."}',
      `title: ${truncateText(input.title, Math.min(500, max))}`,
      `excerpt: ${truncateText(input.excerpt ?? '', Math.min(1000, max))}`,
      `content: ${truncateText(input.content, max)}`,
    ].join('\n');

    const { text, tokensUsed } = await this.generate(prompt);
    const parsed = extractJsonObject(text);
    return {
      title: String(parsed.title ?? '').trim() || input.title,
      excerpt:
        parsed.excerpt === null || parsed.excerpt === undefined
          ? null
          : String(parsed.excerpt),
      content: String(parsed.content ?? '').trim() || input.content,
      tokensUsed,
    };
  }

  async rewrite(input: AiRewritePayload): Promise<AiRewriteOutput> {
    const ai = this.cfg();
    const instruction =
      REWRITE_MODE_PROMPTS[input.mode] ?? REWRITE_MODE_PROMPTS.ameliorer;
    const prompt = [
      instruction,
      'Return ONLY the rewritten text, no JSON, no markdown fences, no preface.',
      truncateText(input.text, ai.maxInputChars),
    ].join('\n\n');

    const { text, tokensUsed } = await this.generate(prompt);
    return { text: text.trim(), tokensUsed };
  }

  private async generate(
    prompt: string,
  ): Promise<{ text: string; tokensUsed: number }> {
    const ai = this.cfg();
    const model = ai.geminiModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ai.geminiApiKey)}`;

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      },
      ai.timeoutMs,
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { totalTokenCount?: number };
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }
    const tokensUsed =
      data.usageMetadata?.totalTokenCount ?? estimateTokens(prompt + text);
    return { text, tokensUsed };
  }
}
