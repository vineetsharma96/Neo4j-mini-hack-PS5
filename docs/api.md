# API reference

All production memory endpoints require `Authorization: Bearer <Firebase ID token>`. The backend verifies the token, checks revocation, and derives the user identity from it. A `userId` in a request body cannot grant access. Project IDs select resources; the server checks ownership independently.

`GET /api/config` is public and returns configuration-presence booleans, not credentials or a service health report. Local demo operations use browser storage rather than these authenticated endpoints.

## Routes

| Route | Method | Input | Response |
| --- | --- | --- | --- |
| `/api/projects` | GET | None | Array of owned projects, newest project update first, up to 100 |
| `/api/projects` | POST | Project fields | Created project; status 201 |
| `/api/projects/:projectId` | GET | None | `{ project, records, relationships }` snapshot |
| `/api/projects/:projectId` | PATCH | Project fields | `{ "ok": true }` |
| `/api/projects/:projectId` | DELETE | None | `{ "ok": true }` |
| `/api/projects/:projectId/records` | POST | Record input | Created record; status 201 |
| `/api/projects/:projectId/records/:recordId` | PATCH | Record input | Updated record |
| `/api/projects/:projectId/records/:recordId` | DELETE | None | `{ "ok": true }` |
| `/api/projects/:projectId/relationships` | POST | Relationship input | Relationship object; status 201 |
| `/api/projects/:projectId/relationships/:relationshipId` | DELETE | None | `{ "ok": true }` |
| `/api/projects/:projectId/ask` | POST | `{ "question": "…" }` | `{ answer, context, source: "gemini" }` |
| `/api/seed` | POST | None | New synthetic project; status 201 |

JSON-bearing requests need `Content-Type: application/json`. Bodies are streamed with a 24,000-byte limit. Field schemas are defined in [model.ts](../src/lib/model.ts); [the Neo4j guide](neo4j.md) lists fields for each record kind.

## Example request bodies

Create or update project metadata. Both fields are required:

```json
{
  "name": "Example API",
  "description": "Decisions and debugging history for this project"
}
```

Create a component record:

```json
{
  "kind": "Component",
  "fields": {
    "name": "Authentication",
    "description": "Issues and refreshes access tokens"
  }
}
```

Record PATCH requests send the full validated field set for the existing kind. They replace the stored fields; they do not change the record kind. IDs, project membership, and update timestamps are server controlled.

Create a relationship using actual IDs from the selected project's snapshot:

```json
{
  "source": "<component-record-id>",
  "target": "<dependency-record-id>",
  "type": "DEPENDS_ON"
}
```

Both endpoints must belong to the owned project, differ from each other, and match the permitted source and target kinds. Repeating the same valid connection reuses its stored relationship ID.

Ask a debugging question:

```json
{
  "question": "Why did we change the authentication module, and could that change be related to the current API error?"
}
```

Questions require 5–2,000 characters after trimming. The response context contains retrieved records, relationships, seed IDs, and a truncation flag. [Architecture](architecture.md) describes the answer fields and citation validation.

## Errors

Errors return an `error` string. Validation failures can also include `issues`, each with `path` and `message`. Raw database errors, provider bodies, keys, and query parameters are not returned.

| Status | Typical meaning |
| --- | --- |
| 400 | Invalid fields, malformed JSON, incompatible relationship, or invalid request |
| 401 | Missing, expired, revoked, or unverifiable token |
| 404 | Missing project, inaccessible project, missing record, or unknown endpoint |
| 405 | Unsupported operation |
| 413 | Request body exceeds the size limit |
| 415 | JSON body sent without the required content type |
| 422 | Project capacity exceeded or no relevant records for an explanation |
| 429 | Application question limit or Gemini quota/rate limit |
| 502 | Rejected model request, malformed answer, invalid citation, or excessive output |
| 503 | Missing service configuration, database/network failure, unavailable model, or provider authorization failure |
| 504 | Gemini explanation deadline exceeded |

Deleting a record or project is permanent through this API. The workspace asks for confirmation before submitting destructive requests. Relationship deletion returns success even if no matching edge remains in the owned project. There is no API undo endpoint.
