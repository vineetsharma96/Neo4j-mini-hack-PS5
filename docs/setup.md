# Setup and configuration

## Local demo without credentials

Use Node.js 20.9 or newer. The project has been verified with Node.js 24. Install the locked dependencies:

```powershell
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) and choose **Explore demo**. This mode uses synthetic records, browser storage, and a scripted explanation. It requires no Firebase, Neo4j, or Gemini credentials.

## Configure authenticated project memory

Create `.env.local` only if it does not already exist:

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
}
```

Fill in the placeholders locally. Keep `.env.local`, service-account JSON files, and connection credential files out of Git. Do not replace an existing environment file with empty placeholders.

| Service | Variables | Setup |
| --- | --- | --- |
| Firebase client | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Use the Firebase web app configuration. `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` is optional. |
| Firebase Admin | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Use a service account from the same Firebase project. The application reads environment variables, not the JSON file directly. |
| Neo4j | `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | Map the local connection file's values to these variables. Use the encrypted Aura connection URI. The database defaults to `neo4j` if omitted. |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | Use a server API key and an available model supporting JSON structured output. No fallback model is hardcoded. |

For the Admin private key, preserve its PEM contents and newlines. A quoted environment value containing escaped `\n` is supported; the server converts those escapes to actual newlines. Never give a server credential a `NEXT_PUBLIC_` prefix.

In Firebase Authentication, enable the providers you plan to use: **Google** and **Email/Password**. Add the local hostname to the authorized domains. The application supports email registration, password reset, provider sign-in, and sign-out.

Restart the application after environment changes. Firebase public variables are included in the browser build, so rebuild production output after changing them. Settings shows configuration presence, not a live connectivity result.

## Check Neo4j and create the schema

```powershell
npm run db:check
npm run db:setup
```

`db:check` verifies driver connectivity and runs `RETURN 1 AS ok`. `db:setup` also creates the TraceReason uniqueness constraints and indexes. Neither command deletes existing records. See [the Neo4j guide](neo4j.md) for the exact schema.

Sign in, create a project, and add a record. Reload to confirm persistent storage. Use **Create sample project** for a new synthetic Orbit API project owned by the signed-in user. The seed action can be repeated and does not reset other projects.

## Run a production build locally

```powershell
npm run build
npm run start
```

Stop a development server using the same port before starting the production server. This is a local run; no external deployment is required.

For live Gemini verification using only synthetic context:

```powershell
npm run test:gemini
```

The command makes a real provider request and can consume API quota. See [testing and troubleshooting](testing.md) for the remaining checks and common errors.
