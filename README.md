# InterviewLab AI

InterviewLab AI is a deploy-ready interview practice platform for students, recent graduates, career switchers, and working professionals. Candidates choose a target role, experience level, and focus area, then complete a five-question practice loop with instant coaching, per-answer scoring, and a completion report.

## What is included

- Manus OAuth authentication and user accounts.
- Persistent interview sessions and question-level evaluations in MySQL/TiDB through Drizzle ORM.
- Server-side AI question generation and answer evaluation through the managed LLM gateway; no API key is exposed to the browser.
- A deterministic fallback question bank and heuristic feedback path so the core practice flow remains usable if the model service is temporarily unavailable.
- Progress dashboard with average score, completed sessions, current track, streak placeholder, and session history.
- Responsive light product UI with mobile-friendly interview flow, accessible controls, reduced-motion support, and production build configuration.

## Recommended free AI option for an external deployment

For a separate deployment outside Manus, the most practical starting option is **Google Gemini API through Google AI Studio**. Google’s official pricing page currently lists a Free tier with limited access to eligible models and free input/output tokens; Google’s billing guide says new accounts begin on the Free tier and are subject to model-specific rate limits. See the official [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [billing](https://ai.google.dev/gemini-api/docs/billing) documentation before shipping a public app because limits and eligible models can change.

A second option is **GroqCloud** for fast inference. Its official rate-limit documentation lists a Free plan with model-specific RPM, RPD, and token quotas; the exact values are account- and model-dependent. See [Groq rate limits](https://console.groq.com/docs/rate-limits).

This project already uses the platform-managed LLM gateway in `server/_core/llm.ts`, which is the safest zero-key path for the attached WebDev deployment. If you move to another host, keep the model call on the server and add your provider key as a server-side secret; never put it in `VITE_*` variables or client code.

## Local development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

The managed WebDev environment supplies the following server-side variables automatically:

- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `VITE_OAUTH_PORTAL_URL`
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

## Product flow

1. Sign in with Manus OAuth.
2. Choose a role, level, and focus area.
3. Start a five-question practice loop.
4. Submit each answer in text form and receive a score, coaching note, strengths, and one or more next steps.
5. Finish the loop to persist the report and see the session in the dashboard history.

## Production notes

The production build uses the standard managed Node runtime. Database schema changes should be generated with `pnpm drizzle-kit generate` and applied through the WebDev database migration flow. LLM calls are intentionally made inside tRPC procedures under `server/routers.ts`, which keeps credentials server-side and lets the app fall back safely when the provider is unavailable.

The current MVP intentionally keeps voice recording and resume parsing out of the critical path. These are natural next features: voice transcription for spoken answers, richer adaptive difficulty based on prior scores, recruiter-style rubrics per role, and shareable reports.
