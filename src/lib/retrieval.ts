import { z } from "zod";
import {
  label,
  type Snapshot,
  type Relationship,
  type MemoryRecord,
} from "./model";
import { makeDemo } from "./demo";
export interface Retrieved {
  records: MemoryRecord[];
  relationships: Relationship[];
  seedIds: string[];
  truncated: boolean;
}
const stop = new Set([
  "the",
  "and",
  "why",
  "did",
  "could",
  "that",
  "this",
  "with",
  "from",
  "have",
  "current",
  "change",
  "changed",
  "related",
  "module",
  "were",
  "does",
  "been",
]);
export function retrieve(snapshot: Snapshot, question: string): Retrieved {
  const projectId = snapshot.project.id;
  const records = snapshot.records.filter((r) => r.projectId === projectId);
  const byId = new Map(records.map((r) => [r.id, r]));
  const edges = snapshot.relationships.filter(
    (e) =>
      e.projectId === projectId && byId.has(e.source) && byId.has(e.target),
  );
  const words = [
    ...new Set(question.toLowerCase().match(/[a-z0-9]+/g) || []),
  ].filter((w) => w.length > 2 && !stop.has(w));
  const ranked = records
    .map((r) => ({
      r,
      score: words.reduce(
        (s, w) =>
          s +
          (JSON.stringify(r.fields).toLowerCase().includes(w) ? 1 : 0) +
          (label(r).toLowerCase().includes(w) ? 2 : 0),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
  const seeds = ranked.slice(0, 6).map((x) => x.r.id);
  const selected = new Set(seeds);
  let frontier = seeds;
  for (let depth = 0; depth < 3; depth++) {
    const next: string[] = [];
    for (const edge of edges) {
      const other = frontier.includes(edge.source)
        ? edge.target
        : frontier.includes(edge.target)
          ? edge.source
          : undefined;
      if (other && !selected.has(other) && selected.size < 24) {
        selected.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  // Per-record field budget guarantees the context stays compact without cutting JSON.
  const compact = records
    .filter((r) => selected.has(r.id))
    .map((r) => ({
      ...r,
      fields: Object.fromEntries(
        Object.entries(r.fields).map(([k, v]) => [
          k,
          v.slice(0, Math.floor(850 / Object.keys(r.fields).length)),
        ]),
      ),
    }));
  const used = edges
    .filter((e) => selected.has(e.source) && selected.has(e.target))
    .slice(0, 40);
  let budgetTruncated = false;
  const bytes = () =>
    new TextEncoder().encode(
      JSON.stringify({ records: compact, relationships: used, seedIds: seeds }),
    ).byteLength;
  while (bytes() > 32000 && used.length) {
    used.pop();
    budgetTruncated = true;
  }
  while (bytes() > 32000 && compact.length) {
    compact.pop();
    budgetTruncated = true;
  }
  const retained = new Set(compact.map((r) => r.id));
  return {
    records: compact,
    relationships: used.filter(
      (e) => retained.has(e.source) && retained.has(e.target),
    ),
    seedIds: seeds.filter((id) => retained.has(id)),
    truncated:
      budgetTruncated ||
      selected.size >= 24 ||
      compact.some((r) =>
        Object.entries(r.fields).some(
          ([k, v]) => v !== byId.get(r.id)?.fields[k],
        ),
      ) ||
      used.length === 40,
  };
}
const claim = z
  .object({
    text: z.string().min(1).max(1600),
    recordIds: z.array(z.string().max(100)).max(12),
    evidenceIds: z.array(z.string().max(100)).max(12),
  })
  .strict();
export const answerSchema = z
  .object({
    summary: z.string().min(1).max(2000),
    facts: z.array(claim).max(8),
    connection: claim,
    checks: z.array(z.string().min(1).max(800)).min(1).max(6),
    uncertainty: z.string().min(1).max(1600),
    supportingEdgeIds: z.array(z.string().max(100)).max(40),
  })
  .strict();
export type Answer = z.infer<typeof answerSchema>;
export function validateAnswer(value: unknown, context: Retrieved): Answer {
  const answer = answerSchema.parse(value);
  const ids = new Set(context.records.map((r) => r.id)),
    evidence = new Set(
      context.records.filter((r) => r.kind === "Evidence").map((r) => r.id),
    ),
    edges = new Set(context.relationships.map((e) => e.id));
  for (const c of [...answer.facts, answer.connection]) {
    if (
      c.recordIds.some((id) => !ids.has(id)) ||
      c.evidenceIds.some((id) => !evidence.has(id))
    )
      throw new Error(
        "The response cited a record outside the retrieved context.",
      );
  }
  if (answer.facts.some((c) => !c.recordIds.length && !c.evidenceIds.length))
    throw new Error("Documented facts must cite retrieved records.");
  if (answer.supportingEdgeIds.some((id) => !edges.has(id)))
    throw new Error("The response cited an unknown graph relationship.");
  return answer;
}
export function demoAnswer(context: Retrieved): Answer {
  const find = (suffix: string) =>
    context.records.find((r) => r.id.endsWith(`-${suffix}`))?.id;
  const refs = (...suffixes: string[]) =>
    suffixes.map(find).filter((id): id is string => !!id);
  const original = retrieve(
    makeDemo(context.records[0]?.projectId || "local-demo"),
    "authentication API token session fix",
  );
  const scenario =
    [
      "decision",
      "reason",
      "bug",
      "fix",
      "session-note",
      "incident-note",
      "test-note",
    ].every((s) => find(s)) &&
    context.records.every((r) => {
      const expected = original.records.find((v) => v.id === r.id);
      return (
        !expected ||
        JSON.stringify(expected.fields) === JSON.stringify(r.fields)
      );
    });
  if (!scenario)
    return {
      summary:
        "Local demo retrieval found the records below. The scripted explanation requires the original synthetic scenario.",
      facts: context.records.slice(0, 4).map((r) => ({
        text: `${r.kind}: ${label(r)}`,
        recordIds: [r.id],
        evidenceIds: [],
      })),
      connection: {
        text: "There is not enough evidence in this local demo to connect these records to a current error.",
        recordIds: [],
        evidenceIds: [],
      },
      checks: [
        "Compare the current error, token claims, and validation settings with the retrieved records.",
      ],
      uncertainty:
        "This is deterministic local retrieval, not a Gemini answer. Reset the demo to restore the sample explanation.",
      supportingEdgeIds: [],
    };
  return validateAnswer(
    {
      summary:
        "The authentication change introduced short-lived access tokens to support persistent sessions. A previous 401 involved inconsistent token validation. That history suggests a refresh-path mismatch is worth checking in the current error.",
      facts: [
        {
          text: "The decision changed token handling to meet the documented session requirements.",
          recordIds: refs("decision", "reason"),
          evidenceIds: refs("session-note"),
        },
        {
          text: "A previous API 401 followed the change. Middleware rejected an unexpected audience claim in refreshed tokens.",
          recordIds: refs("bug"),
          evidenceIds: refs("incident-note"),
        },
        {
          text: "The fix aligned validation settings. Login was tested, but the refresh path remains unverified.",
          recordIds: refs("fix"),
          evidenceIds: refs("test-note"),
        },
      ],
      connection: {
        text: "Hypothesis: the current error may follow the same path if refreshed tokens still use different audience, issuer, or signing settings from API middleware. Connected records show a plausible route to investigate; they do not prove causation.",
        recordIds: refs("auth", "middleware", "token", "bug", "fix"),
        evidenceIds: refs("incident-note", "test-note"),
      },
      checks: [
        "Reproduce a protected API request immediately after login, then after token refresh. Compare both responses.",
        "Compare issuer (iss), audience (aud), expiry (exp), and signing-key selection between freshly issued and refreshed tokens. Do not log raw tokens.",
        "Run the same validation assertions through authentication and API middleware, including the expiry boundary.",
      ],
      uncertainty:
        "The current error response, failing request, and refreshed-token claims are missing. The earlier login smoke test cannot verify refresh behavior. All records and excerpts here are fictional.",
      supportingEdgeIds: context.relationships.map((e) => e.id),
    },
    context,
  );
}
