import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiConfig } from '../../config/ai.config';
import { CmsModule } from '../cms/cms.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDERS } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  imports: [
    CmsModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ai = config.get<AiConfig>('ai');
        return [
          {
            name: 'default',
            ttl: ai?.rateLimitTtlMs ?? 60_000,
            limit: ai?.rateLimit ?? 10,
          },
        ];
      },
    }),
  ],
  controllers: [AiController],
  providers: [
    GeminiProvider,
    GroqProvider,
    OpenAiProvider,
    {
      provide: AI_PROVIDERS,
      useFactory: (
        gemini: GeminiProvider,
        groq: GroqProvider,
        openai: OpenAiProvider,
      ) => [gemini, groq, openai],
      inject: [GeminiProvider, GroqProvider, OpenAiProvider],
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
