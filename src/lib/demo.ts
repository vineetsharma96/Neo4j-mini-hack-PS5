import type { Snapshot, MemoryRecord, Kind } from "./model";
export const demoQuestion =
  "Why did we change the authentication module, and could that change be related to the current API error?";
export function makeDemo(projectId = "local-demo"): Snapshot {
  const now = "2026-10-11T10:00:00.000Z";
  const r = (
    id: string,
    kind: Kind,
    fields: Record<string, string>,
  ): MemoryRecord => ({
    id: `${projectId}-${id}`,
    projectId,
    kind,
    fields,
    updatedAt: now,
  });
  const records = [
    r("auth", "Component", {
      name: "Authentication",
      description: "Handles login, session creation, and access-token refresh.",
    }),
    r("middleware", "Component", {
      name: "API middleware",
      description:
        "Validates access tokens before forwarding requests to protected API routes.",
    }),
    r("token", "Dependency", {
      name: "Token library",
      version: "2.0 (fictional)",
      description: "Synthetic token signing and validation dependency.",
    }),
    r("decision", "Decision", {
      title: "Change authentication token handling",
      description:
        "Move to short-lived access tokens with a separate refresh path. Align issuer and audience claims with the documented session requirements.",
      decidedAt: "2026-10-04",
      alternatives:
        "Keep long-lived tokens; use server-managed sessions. Short-lived tokens were selected to limit the exposure of a stolen access token.",
      revisitConditions:
        "Revisit if refresh failures persist or session requirements change.",
      status: "active",
    }),
    r("reason", "Reason", {
      text: "Support documented session requirements: keep a session across browser restarts while limiting access-token lifetime.",
    }),
    r("bug", "Bug", {
      title: "API returned 401 after token changes",
      symptoms:
        "Login succeeded, but some protected API requests returned 401 after access-token refresh.",
      errorMessage: "401 Unauthorized: token audience mismatch (fictional)",
      status: "resolved",
      occurredAt: "2026-10-05",
    }),
    r("fix", "Fix", {
      title: "Align token validation",
      description:
        "Use the same issuer, audience, and signing settings in authentication and API middleware.",
      appliedAt: "2026-10-06",
      verificationNotes:
        "Login tested. Token refresh path still needs verification.",
      verificationStatus: "partial",
    }),
    r("session-note", "Evidence", {
      type: "document",
      title: "Session requirements",
      url: "",
      excerpt:
        "FICTIONAL DEMO EXCERPT: Sessions should survive browser restarts. Access tokens should expire after 15 minutes; refresh tokens renew them.",
      createdAt: "2026-10-03",
    }),
    r("incident-note", "Evidence", {
      type: "issue",
      title: "401 incident notes",
      url: "",
      excerpt:
        "FICTIONAL DEMO EXCERPT: After the token-handling change, API middleware rejected refreshed tokens with an unexpected audience claim.",
      createdAt: "2026-10-05",
    }),
    r("test-note", "Evidence", {
      type: "test",
      title: "Validation checklist",
      url: "",
      excerpt:
        "FICTIONAL DEMO EXCERPT: Login smoke test passed after aligning validation. Token refresh and expiry boundary tests have not been run.",
      createdAt: "2026-10-06",
    }),
  ];
  const pairs = [
    ["auth", "token", "DEPENDS_ON"],
    ["middleware", "token", "DEPENDS_ON"],
    ["decision", "auth", "AFFECTS"],
    ["decision", "reason", "HAS_REASON"],
    ["decision", "session-note", "SUPPORTED_BY"],
    ["bug", "middleware", "AFFECTS"],
    ["bug", "token", "INVOLVES"],
    ["bug", "fix", "RESOLVED_BY"],
    ["bug", "incident-note", "SUPPORTED_BY"],
    ["fix", "auth", "MODIFIES"],
    ["fix", "middleware", "MODIFIES"],
    ["fix", "test-note", "SUPPORTED_BY"],
  ];
  return {
    project: {
      id: projectId,
      name: "Orbit API",
      description: "Synthetic demo project · Authentication & API reliability",
      synthetic: true,
      createdAt: now,
      updatedAt: now,
    },
    records,
    relationships: pairs.map(([s, t, type], i) => ({
      id: `${projectId}-edge-${i}`,
      projectId,
      source: `${projectId}-${s}`,
      target: `${projectId}-${t}`,
      type,
    })),
  };
}
