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

/**
 * OpenAI provider — prepared for paid replacement.
 * Activate by setting OPENAI_API_KEY (and optionally AI_PROVIDER_PRIORITY=openai).
 * No OpenAI SDK dependency: HTTP only, so swapping config is enough.
 */
@Injectable()
export class OpenAiProvider implements AIProvider {
  readonly name: AiProviderName = 'openai';

  constructor(private readonly config: ConfigService) {}

  private cfg(): AiConfig {
    return this.config.get<AiConfig>('ai')!;
  }

  isConfigured(): boolean {
    return Boolean(this.cfg().openaiApiKey?.trim());
  }

  async translate(input: AiTranslatePayload): Promise<AiTranslateOutput> {
    const ai = this.cfg();
    const max = ai.maxInputChars;
    const user = [
      `Translate CMS article from ${input.sourceLocale} to ${input.targetLocale}.`,
      'Preserve HTML/markdown. Return ONLY JSON: {"title":"...","excerpt":"...","content":"..."}',
      `title: ${truncateText(input.title, Math.min(500, max))}`,
      `excerpt: ${truncateText(input.excerpt ?? '', Math.min(1000, max))}`,
      `content: ${truncateText(input.content, max)}`,
    ].join('\n');

    const { text, tokensUsed } = await this.chat(user);
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
    const user = [
      instruction,
      'Return ONLY the rewritten text.',
      truncateText(input.text, ai.maxInputChars),
    ].join('\n\n');
    const { text, tokensUsed } = await this.chat(user);
    return { text: text.trim(), tokensUsed };
  }

  private async chat(
    userContent: string,
  ): Promise<{ text: string; tokensUsed: number }> {
    const ai = this.cfg();
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ai.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: ai.openaiModel,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: 'You are a precise CMS writing assistant.',
            },
            { role: 'user', content: userContent },
          ],
        }),
      },
      ai.timeoutMs,
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error('OpenAI returned an empty response');
    }
    const tokensUsed =
      data.usage?.total_tokens ?? estimateTokens(userContent + text);
    return { text, tokensUsed };
  }
}
