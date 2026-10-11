# Testing and troubleshooting

## Verification commands

| Command | What it checks | External effects |
| --- | --- | --- |
| `npm run typecheck` | TypeScript types | None |
| `npm run lint` | Source lint rules | None |
| `npm test` | Access boundaries, retrieval, citations, request limits, local state, and provider errors | Mocked services; no live database writes |
| `npm run build` | Production compilation and route generation | Local build output |
| `npm run db:check` | Driver connectivity and `RETURN 1 AS ok` | Read-only database check |
| `npm run db:setup` | Connectivity, constraints, and indexes | Adds TraceReason schema; preserves records |
| `npm run test:live` | Persistence, CRUD, synthetic seed, access rejection, and project isolation | Creates temporary database projects and removes them in cleanup |
| `npm run test:gemini` | Structured answer and citations using synthetic context | Calls Gemini and can consume quota |
| `npm run test:e2e` | Demo workflows, graph interactions, responsive drawers, persistence, and accessibility | Local browser demo state and ignored screenshots |

Install the browser used by the tests once:

```powershell
npx playwright install chromium
```

Playwright starts or reuses `127.0.0.1:3000`. When reusing a production server, rebuild and restart it after source changes so the tests exercise current code. Generated screenshots are under ignored `test-results/`.

`test:live` uses generated test identities to exercise the repository directly; it does not verify the Firebase login UI. Cleanup is in `finally`, but an interrupted process or database outage can prevent cleanup. Inspect only the generated temporary projects if that happens; never clear the whole database to reset a test.

For completed checks and remaining live verification gaps, read [VERIFICATION.md](../VERIFICATION.md). The latest graph-interaction check recorded 20 unit tests and five browser workflows passing, along with type checking, linting, and production build.

## Common problems

| Symptom | Check and action |
| --- | --- |
| Neo4j connectivity check fails | Check the server environment variable names, encrypted Aura URI, username, password, database name, instance availability, and local network. The script deliberately omits raw errors and credentials. |
| Project service error | Verify Neo4j connectivity, server configuration, and the configured database. Retry after resolving the service problem. Production failure does not enable demo mode automatically. |
| Firebase sign-in fails | Confirm Authentication is enabled, the selected provider is enabled, the hostname is authorized, and the browser web configuration belongs to the intended project. |
| Token verification fails | Sign in again. Check that Firebase Admin and browser configuration refer to the same Firebase project and that the private key's newlines are preserved. |
| Project not found after sign-in | Select a project owned by the current account. A known project ID is not proof of access. Local demo projects are separate from authenticated projects. |
| No relevant records found | Include a component name, error message, or decision term that appears in the project's records, or add the missing evidence. Retrieval does not invent matches. |
| Gemini configuration error | Configure both the server key and an available structured-output model, then restart the app. No model fallback is hardcoded. |
| Gemini quota or rate-limit error | Wait for the application window to reset, or check the provider project's quota and billing when the provider reports the limit. |
| Gemini model unavailable or request rejected | Check model availability and JSON structured-output compatibility. Update the model explicitly and restart. |
| Gemini deadline exceeded | Retry the explanation or ask a more specific question. The adapter has a 60-second total deadline. |
| Invalid answer or unsupported citation | Retry. The application intentionally rejects malformed output and IDs outside the retrieved context. It does not display the invalid answer. |
| SDK works in a script but fails in the Next.js server | Confirm `next.config.ts` retains `serverExternalPackages: ["@google/genai"]`. The integration uses the SDK's native Node transport rather than bundling that dependency into the server. |
| Updated configuration is not reflected | Restart development, or rebuild and restart production. Firebase public configuration is part of the browser bundle. |
| Local demo storage fails | Check browser storage availability. The application reports storage failures; do not assume unsaved changes survived reload. |
| Graph drawer opens unexpectedly during movement | Use the current build. Single-click selects, double-click opens, and drag selection does not open details. |

Use the graph footer's **Open selected record** button for a tap alternative to double-click. Keyboard users can focus a graph node and press Enter or Space. Compact drawers keep the background visible while preventing interaction behind the panel.

## Current boundaries

- Record positions are temporary graph layout state rather than persisted Neo4j data.
- Project snapshots are capped at 500 records and 2,000 domain relationships; the project list returns up to 100 entries.
- Retrieval uses English-oriented alphanumeric token matching and bounded in-memory traversal, without embeddings or fuzzy search.
- Rate limiting is in-process and is not coordinated across multiple server instances.
- Citation validation checks known IDs and response structure, not independent semantic truth.
- Deletion has confirmation in the UI but no soft-delete or undo API.
- Uploads, GitHub synchronization, collaboration, and autonomous code editing are outside this version.
- Individual registration, password-reset, and sign-in-provider flows remain separate live verification tasks. Do not infer their verification from repository or demo tests.
