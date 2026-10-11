import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ManagedTransaction } from "neo4j-driver";
import { makeDemo, demoQuestion } from "../src/lib/demo";
import {
  checkRelationship,
  recordInput,
  type MemoryRecord,
} from "../src/lib/model";
import { retrieve, validateAnswer, demoAnswer } from "../src/lib/retrieval";
import { assertOwner } from "../src/lib/server/repository";
import { body, failure } from "../src/lib/server/http";
import { loadLocal, saveLocal } from "../src/lib/local";
describe("project isolation", () => {
  it("rejects a user with no ownership match in the database", async () => {
    const run = vi.fn().mockResolvedValue({ records: [] });
    await expect(
      assertOwner(
        { run } as unknown as ManagedTransaction,
        "attacker",
        "private-project",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(run.mock.calls[0][0]).toContain("firebaseUid:$uid");
    expect(run.mock.calls[0][0]).toContain("-[:OWNS]->");
    expect(run.mock.calls[0][1]).toEqual({
      uid: "attacker",
      projectId: "private-project",
    });
  });
  it("rejects relationships across projects and incompatible record types", () => {
    const a = makeDemo("a"),
      b = makeDemo("b");
    expect(() =>
      checkRelationship("a", a.records[0], b.records[2], "DEPENDS_ON"),
    ).toThrow("selected project");
    expect(() =>
      checkRelationship("a", a.records[0], a.records[2], "SUPPORTED_BY"),
    ).toThrow("not valid");
    expect(() =>
      checkRelationship("a", a.records[0], a.records[0], "AFFECTS"),
    ).toThrow("different");
    expect(() =>
      checkRelationship("a", a.records[0], a.records[2], "DEPENDS_ON"),
    ).not.toThrow();
  });
  it("keeps retrieval within the selected project, even with contaminated inputs", () => {
    const a = makeDemo("a"),
      b = makeDemo("b");
    const data = {
      ...a,
      records: [...a.records, ...b.records],
      relationships: [
        ...a.relationships,
        ...b.relationships,
        {
          id: "bad",
          projectId: "a",
          source: "a-auth",
          target: "b-token",
          type: "DEPENDS_ON",
        },
      ],
    };
    const result = retrieve(data, demoQuestion);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records.every((r) => r.projectId === "a")).toBe(true);
    expect(result.relationships.some((e) => e.id === "bad")).toBe(false);
  });
  it("bounds expansion to 3 steps and limits the record/context budget", () => {
    const project = makeDemo().project;
    const records: MemoryRecord[] = Array.from({ length: 40 }, (_, i) => ({
      id: `n${i}`,
      projectId: project.id,
      kind: "Component",
      updatedAt: project.updatedAt,
      fields: {
        name: i === 0 ? "needle" : "other",
        description: "x".repeat(4000),
      },
    }));
    const relationships = records.slice(1).map((r, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: r.id,
      type: "AFFECTS",
      projectId: project.id,
    }));
    const context = retrieve({ project, records, relationships }, "needle");
    expect(context.records.map((r) => r.id)).toEqual(["n0", "n1", "n2", "n3"]);
    const broad = retrieve({ project, records, relationships }, "other");
    expect(broad.records.length).toBeLessThanOrEqual(24);
    expect(JSON.stringify(broad).length).toBeLessThan(30000);
  });
});
describe("validated answers", () => {
  const context = retrieve(makeDemo(), demoQuestion);
  it("accepts a supported answer that separates a hypothesis from facts", () => {
    const answer = demoAnswer(context);
    expect(() => validateAnswer(answer, context)).not.toThrow();
    expect(answer.connection.text).toContain("do not prove causation");
  });
  it("rejects hallucinated record, evidence, and graph citations", () => {
    const answer = demoAnswer(context);
    expect(() =>
      validateAnswer(
        {
          ...answer,
          connection: { ...answer.connection, recordIds: ["foreign-record"] },
        },
        context,
      ),
    ).toThrow("outside");
    expect(() =>
      validateAnswer(
        {
          ...answer,
          connection: {
            ...answer.connection,
            evidenceIds: ["local-demo-auth"],
          },
        },
        context,
      ),
    ).toThrow("outside");
    expect(() =>
      validateAnswer(
        { ...answer, supportingEdgeIds: ["invented-edge"] },
        context,
      ),
    ).toThrow("unknown");
  });
  it("rejects malformed answers and unsupported facts", () => {
    expect(() =>
      validateAnswer({ summary: "Only a summary" }, context),
    ).toThrow();
    const answer = demoAnswer(context);
    expect(() =>
      validateAnswer(
        {
          ...answer,
          facts: [
            { text: "Unsupported assertion", recordIds: [], evidenceIds: [] },
          ],
        },
        context,
      ),
    ).toThrow("must cite");
  });
  it("does not reuse the scripted explanation after its source notes change", () => {
    const data = makeDemo();
    data.records.find((r) => r.kind === "Decision")!.fields.description =
      "New decision unrelated to sessions.";
    const answer = demoAnswer(retrieve(data, demoQuestion));
    expect(answer.summary).toContain("scripted explanation requires");
  });
});
describe("request validation and local persistence", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });
  it("persists and reloads the synthetic scenario", () => {
    const data = makeDemo();
    data.records[0].fields.name = "Edited auth";
    saveLocal([data]);
    expect(loadLocal()[0].records[0].fields.name).toBe("Edited auth");
  });
  it("rejects unknown kinds, oversized notes, and non-HTTP evidence URLs", () => {
    expect(recordInput.safeParse({ kind: "Admin", fields: {} }).success).toBe(
      false,
    );
    expect(
      recordInput.safeParse({
        kind: "Reason",
        fields: { text: "x".repeat(4001) },
      }).success,
    ).toBe(false);
    expect(
      recordInput.safeParse({
        kind: "Evidence",
        fields: {
          type: "note",
          title: "Bad link",
          url: "javascript:alert(1)",
          excerpt: "",
          createdAt: "2026-10-11",
        },
      }).success,
    ).toBe(false);
  });
  it("rejects excessive request bodies and sanitizes unexpected service errors", async () => {
    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "x".repeat(25000) }),
    });
    await expect(body(request)).rejects.toMatchObject({ status: 413 });
    const response = failure(new Error("secret-password"));
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret-password",
    );
  });
});
