import { randomUUID } from "node:crypto";
import type { ManagedTransaction } from "neo4j-driver";
import {
  checkRelationship,
  type Project,
  type Snapshot,
  type MemoryRecord,
  type Relationship,
  type Kind,
} from "../model";
import { makeDemo } from "../demo";
import { transaction } from "./db";
import { AppError } from "./errors";
const owned =
  "MATCH (u:TraceReasonUser {firebaseUid:$uid})-[:OWNS]->(p:TraceReasonProject {id:$projectId})";
export async function assertOwner(
  tx: ManagedTransaction,
  uid: string,
  projectId: string,
) {
  const r = await tx.run(`${owned} RETURN p.id AS id`, { uid, projectId });
  if (!r.records.length)
    throw new AppError(404, "Project not found or you do not have access.");
}
const project = (v: Record<string, unknown>) => v as unknown as Project;
function record(v: Record<string, unknown>): MemoryRecord {
  const { id, projectId, kind, updatedAt, ...fields } = v;
  return {
    id: id as string,
    projectId: projectId as string,
    kind: kind as Kind,
    updatedAt: updatedAt as string,
    fields: fields as Record<string, string>,
  };
}
export async function listProjects(uid: string) {
  return transaction(false, async (tx) => {
    const r = await tx.run(
      "MATCH (:TraceReasonUser {firebaseUid:$uid})-[:OWNS]->(p:TraceReasonProject) RETURN properties(p) AS p ORDER BY p.updatedAt DESC LIMIT 100",
      { uid },
    );
    return r.records.map((r) => project(r.get("p")));
  });
}
export async function createProject(
  uid: string,
  fields: { name: string; description: string },
) {
  const id = randomUUID(),
    now = new Date().toISOString();
  return transaction(true, async (tx) => {
    const r = await tx.run(
      "MERGE (u:TraceReasonUser {firebaseUid:$uid}) CREATE (p:TraceReasonProject {id:$id,name:$name,description:$description,createdAt:$now,updatedAt:$now}) CREATE (u)-[:OWNS]->(p) RETURN properties(p) AS p",
      { uid, id, now, ...fields },
    );
    return project(r.records[0].get("p"));
  });
}
export async function snapshot(
  uid: string,
  projectId: string,
): Promise<Snapshot> {
  return transaction(false, async (tx) => {
    await assertOwner(tx, uid, projectId);
    const pr = await tx.run(`${owned} RETURN properties(p) AS p`, {
      uid,
      projectId,
    });
    const rr = await tx.run(
      `${owned} MATCH (r:TraceReasonRecord {projectId:p.id}) RETURN properties(r) AS r ORDER BY r.updatedAt DESC LIMIT 501`,
      { uid, projectId },
    );
    if (rr.records.length > 500)
      throw new AppError(
        422,
        "This MVP supports up to 500 records per project.",
      );
    const er = await tx.run(
      `${owned} MATCH (a:TraceReasonRecord {projectId:p.id})-[e]->(b:TraceReasonRecord {projectId:p.id}) WHERE e.projectId=p.id RETURN e.id AS id,a.id AS source,b.id AS target,type(e) AS type,e.projectId AS projectId LIMIT 2001`,
      { uid, projectId },
    );
    if (er.records.length > 2000)
      throw new AppError(
        422,
        "This MVP supports up to 2,000 relationships per project.",
      );
    return {
      project: project(pr.records[0].get("p")),
      records: rr.records.map((r) => record(r.get("r"))),
      relationships: er.records.map((r) => r.toObject() as Relationship),
    };
  });
}
export async function updateProject(
  uid: string,
  projectId: string,
  fields: { name: string; description: string },
) {
  return transaction(true, async (tx) => {
    await assertOwner(tx, uid, projectId);
    await tx.run(`${owned} SET p += $fields,p.updatedAt=$now`, {
      uid,
      projectId,
      fields,
      now: new Date().toISOString(),
    });
  });
}
export async function deleteProject(uid: string, projectId: string) {
  return transaction(true, async (tx) => {
    await assertOwner(tx, uid, projectId);
    await tx.run(
      `${owned} OPTIONAL MATCH (r:TraceReasonRecord {projectId:p.id}) DETACH DELETE r,p`,
      { uid, projectId },
    );
  });
}
const has: Record<Kind, string> = {
  Component: "HAS_COMPONENT",
  Dependency: "HAS_DEPENDENCY",
  Decision: "HAS_DECISION",
  Reason: "HAS_REASON",
  Bug: "HAS_BUG",
  Fix: "HAS_FIX",
  Evidence: "HAS_EVIDENCE",
};
export async function saveRecord(
  uid: string,
  projectId: string,
  input: { kind: Kind; fields: Record<string, string> },
  id?: string,
) {
  const recordId = id || randomUUID();
  return transaction(true, async (tx) => {
    await assertOwner(tx, uid, projectId);
    const props = {
      ...input.fields,
      id: recordId,
      projectId,
      kind: input.kind,
      updatedAt: new Date().toISOString(),
    };
    if (id) {
      const r = await tx.run(
        `${owned} MATCH (r:TraceReasonRecord {id:$id,projectId:p.id,kind:$kind}) SET r=$props RETURN r.id AS id`,
        { uid, projectId, id, kind: input.kind, props },
      );
      if (!r.records.length)
        throw new AppError(404, "Record not found in this project.");
    } else {
      const count = await tx.run(
        `${owned} SET p.updatedAt=$now WITH p OPTIONAL MATCH (r:TraceReasonRecord {projectId:p.id}) RETURN count(r) AS count`,
        { uid, projectId, now: props.updatedAt },
      );
      if (count.records[0].get("count").toNumber() >= 500)
        throw new AppError(422, "The project record limit is 500.");
      // Labels and relationship types come only from the validated closed Kind enum.
      await tx.run(
        `${owned} CREATE (r:TraceReasonRecord:${input.kind}) SET r=$props CREATE (p)-[:${has[input.kind]}]->(r)`,
        { uid, projectId, props },
      );
    }
    return record(props);
  });
}
export async function deleteRecord(uid: string, projectId: string, id: string) {
  return transaction(true, async (tx) => {
    await assertOwner(tx, uid, projectId);
    const r = await tx.run(
      `${owned} MATCH (r:TraceReasonRecord {id:$id,projectId:p.id}) WITH r,r.id AS id DETACH DELETE r RETURN id`,
      { uid, projectId, id },
    );
    if (!r.records.length)
      throw new AppError(404, "Record not found in this project.");
  });
}
export async function createRelationship(
  uid: string,
  projectId: string,
  input: { source: string; target: string; type: string },
) {
  const id = randomUUID();
  return transaction(true, async (tx) => {
    await assertOwner(tx, uid, projectId);
    const rr = await tx.run(
      `${owned} MATCH (r:TraceReasonRecord {projectId:p.id}) WHERE r.id IN $ids RETURN properties(r) AS r`,
      { uid, projectId, ids: [input.source, input.target] },
    );
    const records = rr.records.map((r) => record(r.get("r")));
    try {
      checkRelationship(
        projectId,
        records.find((r) => r.id === input.source),
        records.find((r) => r.id === input.target),
        input.type,
      );
    } catch {
      throw new AppError(
        400,
        "Choose compatible records from the same project.",
      );
    }
    const count = await tx.run(
      `${owned} SET p.updatedAt=$now WITH p MATCH (:TraceReasonRecord {projectId:p.id})-[e]->(:TraceReasonRecord {projectId:p.id}) WHERE e.projectId=p.id RETURN count(e) AS count`,
      { uid, projectId, now: new Date().toISOString() },
    );
    if (count.records[0].get("count").toNumber() >= 2000)
      throw new AppError(422, "The project relationship limit is 2,000.");
    const result = await tx.run(
      `${owned} MATCH (a:TraceReasonRecord {id:$source,projectId:p.id}),(b:TraceReasonRecord {id:$target,projectId:p.id}) MERGE (a)-[e:${input.type} {projectId:$projectId}]->(b) ON CREATE SET e.id=$id RETURN e.id AS id`,
      { uid, projectId, ...input, id },
    );
    return { ...input, id: result.records[0].get("id") as string, projectId };
  });
}
export async function deleteRelationship(
  uid: string,
  projectId: string,
  id: string,
) {
  return transaction(true, async (tx) => {
    await assertOwner(tx, uid, projectId);
    await tx.run(
      `${owned} MATCH (:TraceReasonRecord {projectId:p.id})-[e {id:$id,projectId:p.id}]->(:TraceReasonRecord {projectId:p.id}) DELETE e`,
      { uid, projectId, id },
    );
  });
}
export async function seed(uid: string): Promise<Project> {
  const id = `demo-${randomUUID()}`,
    demo = makeDemo(id);
  return transaction(true, async (tx) => {
    await tx.run(
      "MERGE (u:TraceReasonUser {firebaseUid:$uid}) CREATE (p:TraceReasonProject) SET p=$props CREATE (u)-[:OWNS]->(p)",
      { uid, props: demo.project },
    );
    for (const r of demo.records)
      await tx.run(
        `MATCH (p:TraceReasonProject {id:$projectId}) CREATE (r:TraceReasonRecord:${r.kind}) SET r=$props CREATE (p)-[:${has[r.kind]}]->(r)`,
        {
          projectId: id,
          props: {
            ...r.fields,
            id: r.id,
            projectId: id,
            kind: r.kind,
            updatedAt: r.updatedAt,
          },
        },
      );
    for (const e of demo.relationships)
      await tx.run(
        `MATCH (a:TraceReasonRecord {id:$source,projectId:$projectId}),(b:TraceReasonRecord {id:$target,projectId:$projectId}) CREATE (a)-[e:${e.type}]->(b) SET e.id=$id,e.projectId=$projectId`,
        e,
      );
    return demo.project;
  });
}
