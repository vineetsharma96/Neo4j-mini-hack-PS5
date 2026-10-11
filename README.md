# TraceReason

**Your codebase remembers why.**

TraceReason connects technical decisions, components, dependencies, bugs, fixes, reasons, and evidence. Ask a debugging question, inspect the retrieved records, follow the supporting graph connections, and verify a clearly labelled hypothesis.

## What you can do

- Record decisions, reasons, components, dependencies, bugs, fixes, and evidence.
- Connect records and explore their relationships in an interactive graph.
- Ask a debugging question and inspect evidence-linked facts, hypotheses, and suggested checks.
- Keep authenticated project memory in Neo4j, or explore a separate synthetic local demo.

## Documentation

Start with the [documentation index](docs/README.md).

| Guide | Contents |
| --- | --- |
| [How Neo4j is used](docs/neo4j.md) | Graph model, constraints, transactions, ownership checks, parameterized Cypher, and persistence |
| [Setup](docs/setup.md) | Local demo and Firebase, Neo4j Aura, and Gemini configuration |
| [Architecture](docs/architecture.md) | Request flow, bounded retrieval, answer validation, and source map |
| [API reference](docs/api.md) | Routes, request examples, responses, and errors |
| [Demo walkthrough](docs/demo.md) | Authentication-change investigation and graph interactions |
| [Testing and troubleshooting](docs/testing.md) | Checks, service failures, and implementation limits |

## Run locally

Requires Node.js 20.9 or newer (verified here with Node.js 24).

```powershell
npm ci
npm run dev
```

Open [TraceReason locally](http://localhost:3000). Choose **Explore demo** to use the complete synthetic scenario without an account. The local demo works without external credentials, stores records in this browser, and uses a deterministic explanation. It never calls Gemini or writes to Neo4j. Storage failure is displayed; production service failure never switches into demo mode.

For authenticated storage and live explanations, follow [setup and configuration](docs/setup.md), create `.env.local` from `.env.example` if it does not already exist, then run `npm run db:check` and `npm run db:setup`. Do not overwrite an existing environment file. Local credential files, environment files, generated build output, and test screenshots are ignored by Git. No secrets belong in source, logs, evidence, or AI prompts.

## Configuration

All variables are listed in `.env.example`. Restart the app after changing environment variables; Firebase public variables are built into the client bundle.

| Service | Required variables | Purpose |
| --- | --- | --- |
| Firebase web app | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser sign-in. Get the web app config from Firebase project settings. Messaging sender ID is optional. |
| Firebase Admin | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Verify Firebase ID tokens on the server. Use a service account from the same Firebase project. A private key can use escaped `\n` newlines in a quoted environment value. |
| Neo4j | `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | Persistent, project-scoped graph storage. Use the Aura encrypted connection URI. |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | Server-side structured explanations. Choose a currently available model that supports JSON structured output; there is no hardcoded model fallback. |

Enable **Google** and **Email/Password** in Firebase Authentication, and add the local hostname to authorized domains. Firebase handles registration, sign-in, password reset, and sign-out. Keep Firebase Admin credentials, Neo4j credentials, and the Gemini key exclusively on the server. Never place them in `NEXT_PUBLIC_*` variables.

Settings reports whether configuration is present, not whether a service is healthy. Missing Admin or Gemini configuration produces an actionable error. See [VERIFICATION.md](VERIFICATION.md) for completed live checks and flows that remain unverified.

## Demo walkthrough

1. Select **Explore demo** on the welcome screen. The synthetic **Orbit API** project opens in Graph.
2. Double-click a decision node, press Enter on a focused node, or use **Open selected record**. A single click selects the node; dragging moves it without opening the drawer. **Decision Memory** shows its reason, alternatives, and revisit conditions. Evidence records contain explicitly fictional excerpts with no fabricated commit URLs.
3. Open **Debug assistant** and select **Trace the connection** with the prefilled question: “Why did we change the authentication module, and could that change be related to the current API error?”
4. Read the documented facts, possible connection, checks, and uncertainty in the contextual panel. The graph highlights supporting connections; use **Pause path animation** to stop it. Reduced-motion preferences disable animation.
5. Select **Validation checklist** in the answer to open its evidence record. The prior login smoke test passed, but token refresh remains unverified. The next check is to compare requests and token claims before and after refresh without logging raw tokens.
6. Add or edit a record in Memory, connect records through the relationship form, and reload to verify local persistence. Use Settings → **Reset demo** to restore the sample.
7. After Firebase configuration, sign in and select **Create sample project** to seed a separate synthetic project in your own Neo4j account. Each action creates a new sample, preserving other projects. Authenticated explanations use Gemini when configured.

The scripted sample explanation is available for the unchanged demo scenario. If its source records are edited or removed, local retrieval displays a limited explanation and tells you to reset the demo; it does not pretend to generate a live answer.

## Architecture

- Next.js App Router and TypeScript: `/` welcome, `/auth` authentication, `/app` workspace with internal tabs and panels.
- Tailwind v4 with a small CSS design system; Geist typography, Lucide icons, Motion entrance animation, and lazy-loaded React Flow. Mobile navigation and contextual panels use drawers. Search, filters, selected records, projects, and workspace tabs have URL state.
- Firebase client obtains an ID token for each API request. Firebase Admin verifies signature, expiry, and revocation. The backend derives identity only from the verified UID; client-provided user IDs cannot grant access.
- Neo4j's official driver uses managed transactions and parameterized values. Record kinds and relationship types come from closed validated allowlists. Every production operation is scoped to project ownership and every project-owned record, including Reason, has `projectId`.
- `TraceReasonUser`, `TraceReasonProject`, and `TraceReasonRecord` provide namespace isolation from pre-existing database contents. Records also carry their domain label (`Decision`, `Bug`, etc.). Uniqueness constraints cover UID and project/record IDs; indexes cover project ID and project/kind. Project-to-Reason uses `HAS_REASON` to retain explicit membership.
- Deleting a record removes its connections. Deleting a project removes only the selected project's TraceReason records. Destructive UI actions require confirmation.
- Gemini is behind a server-only adapter. No model-selected queries, tools, embeddings, Firestore usage, or additional databases.

### Retrieval and answers

1. Verify Firebase identity and project ownership.
2. Read the selected project's bounded graph snapshot (maximum 500 records and 2,000 connections).
3. Rank deterministic text matches and start from up to 6 records.
4. Expand at most 3 steps, including up to 24 records and 40 connections. Compact fields before building the model context and enforce a 32 KB context budget; report when context was truncated.
5. Treat all retrieved notes and the question as untrusted data. Request JSON structured output from the configured Gemini model with a 60-second total deadline, low thinking for Gemini 3 models, and a 4,000-token output limit.
6. Validate with Zod and reject references outside retrieved record, evidence, or relationship IDs. Reject unsupported facts, malformed responses, and output over 24,000 characters. Display a retryable error instead of an invented answer.
7. Render evidence buttons and highlight the validated supporting graph connections.

Questions are limited to 2,000 characters and 10 calls per user per minute per server process. JSON request bodies are streamed with a 24 KB limit. Notes are limited to 4,000 characters. The rate limiter is deliberately in-process for this single-server MVP; multi-instance deployments would require shared enforcement.

### API

All endpoints except `/api/config` require `Authorization: Bearer <Firebase ID token>`.

| Endpoint | Methods |
| --- | --- |
| `/api/projects` | GET list, POST create |
| `/api/projects/:projectId` | GET snapshot, PATCH metadata, DELETE project |
| `/api/projects/:projectId/records` | POST record |
| `/api/projects/:projectId/records/:recordId` | PATCH record, DELETE record |
| `/api/projects/:projectId/relationships` | POST validated relationship |
| `/api/projects/:projectId/relationships/:relationshipId` | DELETE relationship |
| `/api/projects/:projectId/ask` | POST debugging question |
| `/api/seed` | POST new synthetic project for the verified user |
| `/api/config` | GET configuration-presence booleans only |

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run db:check
# Adds only TraceReason constraints and indexes:
npm run db:setup
# Creates isolated temporary projects, asserts isolation/persistence, then removes them:
npm run test:live
npx playwright install chromium
npm run test:e2e
# Uses only the synthetic scenario to verify the configured Gemini adapter:
npm run test:gemini
```

Playwright starts or reuses a local dev server. It exercises the demo, record CRUD, relationships, reload persistence, evidence navigation, confirmations, reset, empty/error states, mobile drawers, and reduced motion. Axe checks accessibility. Screenshots are written under ignored `test-results/`.

See [VERIFICATION.md](VERIFICATION.md) for completed checks and [testing and troubleshooting](docs/testing.md) for commands, service errors, and known limitations.

## Official integration references

Package versions were checked against the npm registry and locked in `package-lock.json`. Integration guidance was checked against [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Neo4j managed transactions](https://neo4j.com/docs/javascript-manual/current/transactions/), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [React Flow](https://reactflow.dev/learn), and [Tailwind's Next.js setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs). The installed Next.js documentation under `node_modules/next/dist/docs/` was also reviewed. The UI was reviewed against [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).

The [Relay reference](https://www.getlayers.ai/layer/relay) was accessible as a gallery entry; its full visual design was not available in the extracted page. TraceReason uses the supplied charcoal/orange direction with original branding, content, and interface.

No external deployment or publishing is part of this project.
