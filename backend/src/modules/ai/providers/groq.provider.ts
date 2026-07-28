import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
  truncateText,
} from './ai-http.util';

const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Groq Cloud (free tier) via OpenAI SDK — same pattern as HopMed Aya.
 * Not xAI Grok. Controllers/CMS depend on `AIProvider` only.
 */
@Injectable()
export class GroqProvider implements AIProvider {
  readonly name: AiProviderName = 'groq';

  constructor(private readonly config: ConfigService) {}

  private cfg(): AiConfig {
    return this.config.get<AiConfig>('ai')!;
  }

  isConfigured(): boolean {
    return Boolean(this.cfg().groqApiKey?.trim());
  }

  private client(): OpenAI {
    const ai = this.cfg();
    return new OpenAI({
      apiKey: ai.groqApiKey,
      baseURL: ai.groqBaseUrl || DEFAULT_GROQ_BASE_URL,
      timeout: ai.timeoutMs,
      maxRetries: 0,
    });
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
    try {
      const completion = await this.client().chat.completions.create({
        model: ai.groqModel,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are a precise CMS writing assistant.',
          },
          { role: 'user', content: userContent },
        ],
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!text) {
        throw new Error('Groq returned an empty response');
      }
      const tokensUsed =
        completion.usage?.total_tokens ?? estimateTokens(userContent + text);
      return { text, tokensUsed };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Groq ')) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Groq API error: ${msg.slice(0, 300)}`);
    }
  }
}
