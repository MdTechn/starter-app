# CMS AI — Traduction & réécriture

Module NestJS interchangeable pour la traduction automatique et la
réécriture d’articles CMS. **Aucune clé API côté frontend** — tout passe
par `/api/ai/*`.

> **Groq ≠ Grok** — le provider gratuit (comme HopMed Aya) est
> [Groq Cloud](https://console.groq.com/) (`api.groq.com`), pas xAI Grok.

## Architecture provider

```
AiController  →  AiService  →  AIProvider[]
                                  ├─ GroqProvider     (priorité — free tier)
                                  ├─ GeminiProvider
                                  └─ OpenAiProvider   (remplacement payant)
```

Le code métier (`AiService`, CMS, UI) dépend uniquement de l’interface
`AIProvider` (`translate` / `rewrite`). **Jamais** d’import SDK dans le CMS.

Sélection automatique :

1. Liste `AI_PROVIDER_PRIORITY` (défaut `groq,gemini,openai`)
2. Ne garde que les providers dont la clé API est définie
3. Sur erreur / timeout → **fallback** vers le provider suivant

(`grok` dans la priorité est accepté comme alias de `groq`.)

## Variables d’environnement

```bash
# Priorité : Groq gratuit (HopMed) en premier
AI_PROVIDER_PRIORITY=groq,gemini,openai

GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

# Optionnel
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_MODEL=gemini-2.0-flash
OPENAI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=30000
AI_MAX_INPUT_CHARS=12000
```

Ne jamais committer de clés. Les valeurs vides désactivent le provider.

### Groq gratuit (comme HopMed)

Même stack qu’Aya : SDK OpenAI + `baseURL=https://api.groq.com/openai/v1`.

1. Compte gratuit sur [console.groq.com](https://console.groq.com/)
2. **API Keys** → Create → copier la clé `gsk_…`
3. Dans `.env` :

```bash
AI_PROVIDER_PRIORITY=groq,gemini,openai
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
# plus rapide / moins cher en tokens :
# GROQ_MODEL=llama-3.1-8b-instant
```

4. Redémarrer l’API — `GET /api/ai/status` → `"active": "groq"`

### Gemini (fallback)

1. Clé sur [Google AI Studio](https://aistudio.google.com/apikey)
2. `GEMINI_API_KEY=...`

### Remplacement futur par OpenAI payant

```bash
AI_PROVIDER_PRIORITY=openai
OPENAI_API_KEY=sk-...
```

Ou secours : `AI_PROVIDER_PRIORITY=groq,openai`

## API

Préfixe global : `/api`. Auth Bearer + permissions CMS.

| Méthode | Route | Permission | Rôle |
|---------|-------|------------|------|
| GET | `/ai/status` | `cms:read` | Provider actif / disponibles |
| GET | `/ai/usage` | ADMIN | Agrégats tokens / requêtes (`startDate`, `endDate`, `userId`) |
| POST | `/ai/translate` | `cms:write` | **Preview** traduction (ne persiste pas) |
| POST | `/ai/rewrite` | `cms:write` | Réécrit un texte (sans persister) |

**Rate limit** : 10 req/min (`@nestjs/throttler`) sur `/ai/*`.  
**Quota** : `AI_DAILY_TOKEN_QUOTA` (défaut 100000) — si dépassé → HTTP 429.

### `POST /ai/translate` (preview)

Ne crée / ne met **pas** à jour `CmsTranslation`. Réponse :

```json
{
  "ok": true,
  "preview": true,
  "provider": "groq",
  "sourceLocale": "fr",
  "targetLocale": "en",
  "tokensUsed": 123,
  "translation": { "title": "…", "excerpt": "…", "content": "…" }
}
```

L’UI propose Accepter → `PUT /cms/articles/:id/translations/:locale`.

### `GET /ai/usage` (ADMIN)

```
GET /ai/usage?startDate=2026-07-01&endDate=2026-07-28&userId=…
```

Retour : `totalRequests`, `totalTokens`, `byProvider[]`, `byOperation[]`.

### `POST /ai/rewrite`

```json
{
  "text": "…",
  "mode": "ameliorer"
}
```

Modes : `ameliorer` | `professionnel` | `court` | `long` | `seo` | `corriger`.

## Optimisation des coûts

- Priorité Groq free tier (puis Gemini / OpenAI)
- Truncation `AI_MAX_INPUT_CHARS` avant l’appel
- Rejet des appels inutiles (locales identiques, texte vide / trop court)
- Timeout + fallback
- Rate-limit 10/min + quota journalier tokens
- Compteur `AiUsage` (`userId`, `organizationId`, `provider`, `operation`, `tokensUsed`)
- Métriques Prometheus : `ai_requests_total`, `ai_tokens_total`, `ai_request_duration_seconds`
- UI admin : `/admin/ai-usage` (filtres dates / userId)

## Modèle Prisma

```prisma
model AiUsage {
  id             String   @id @default(cuid())
  organizationId String?
  userId         String?
  provider       String
  operation      String
  tokensUsed     Int      @default(0)
  createdAt      DateTime @default(now())
}
```

## UI CMS

Éditeur `/cms/articles/[id]` : Traduire / Réécrire avec IA (accepter / refuser).

## Fichiers clés

```
backend/src/modules/ai/
  ai.module.ts
  ai.controller.ts
  ai.service.ts
  providers/
    ai-provider.interface.ts
    groq.provider.ts
    gemini.provider.ts
    openai.provider.ts
backend/src/config/ai.config.ts
docs/AI.md
```
