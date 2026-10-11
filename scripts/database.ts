import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { getDriver, schema, transaction } from "../src/lib/server/db";
import * as repo from "../src/lib/server/repository";
import { retrieve } from "../src/lib/retrieval";
async function main() {
  const command = process.argv[2];
  await getDriver().verifyConnectivity();
  await transaction(false, async (tx) => {
    const r = await tx.run("RETURN 1 AS ok");
    assert.equal(r.records[0].get("ok").toNumber(), 1);
  });
  console.log("Neo4j connectivity verified with a harmless query.");
  if (command === "setup") {
    for (const query of schema)
      await transaction(true, async (tx) => {
        await tx.run(query);
      });
    console.log(
      "TraceReason constraints and indexes are ready. Existing data preserved.",
    );
  }
  if (command === "test") {
    const uid = `tracereason-test-${randomUUID()}`,
      other = `tracereason-test-${randomUUID()}`;
    const ids: string[] = [];
    try {
      const a = await repo.createProject(uid, {
        name: "Temporary integration test",
        description: "Isolated test data",
      });
      ids.push(a.id);
      const b = await repo.createProject(uid, {
        name: "Temporary second project",
        description: "Isolated test data",
      });
      ids.push(b.id);
      const r = await repo.saveRecord(uid, a.id, {
        kind: "Component",
        fields: {
          name: "Authentication test",
          description: "Persistence check",
        },
      });
      const dep = await repo.saveRecord(uid, b.id, {
        kind: "Dependency",
        fields: {
          name: "Token test",
          version: "test",
          description: "Scope check",
        },
      });
      assert.equal((await repo.snapshot(uid, a.id)).records[0].id, r.id);
      await assert.rejects(repo.snapshot(other, a.id));
      await assert.rejects(
        repo.updateProject(other, a.id, {
          name: "Unauthorized",
          description: "",
        }),
      );
      await assert.rejects(
        repo.saveRecord(other, a.id, {
          kind: "Reason",
          fields: { text: "Unauthorized" },
        }),
      );
      await assert.rejects(repo.deleteProject(other, a.id));
      await assert.rejects(
        repo.createRelationship(uid, a.id, {
          source: r.id,
          target: dep.id,
          type: "DEPENDS_ON",
        }),
      );
      const context = retrieve(
        await repo.snapshot(uid, a.id),
        "Authentication token test",
      );
      assert.ok(context.records.every((v) => v.projectId === a.id));
      await repo.saveRecord(
        uid,
        a.id,
        {
          kind: "Component",
          fields: {
            name: "Updated auth",
            description: "Updated persistence check",
          },
        },
        r.id,
      );
      assert.equal(
        (await repo.snapshot(uid, a.id)).records[0].fields.name,
        "Updated auth",
      );
      const sameProjectDependency = await repo.saveRecord(uid, a.id, {
        kind: "Dependency",
        fields: {
          name: "Same-project token",
          version: "test",
          description: "Positive relationship check",
        },
      });
      const connection = await repo.createRelationship(uid, a.id, {
        source: r.id,
        target: sameProjectDependency.id,
        type: "DEPENDS_ON",
      });
      assert.ok(
        (await repo.snapshot(uid, a.id)).relationships.some(
          (e) => e.id === connection.id,
        ),
      );
      await repo.deleteRecord(uid, a.id, r.id);
      const afterDelete = await repo.snapshot(uid, a.id);
      assert.ok(!afterDelete.records.some((v) => v.id === r.id));
      assert.equal(afterDelete.relationships.length, 0);
      const demo = await repo.seed(uid);
      ids.push(demo.id);
      const seeded = await repo.snapshot(uid, demo.id);
      assert.equal(seeded.records.length, 10);
      assert.equal(seeded.relationships.length, 12);
      assert.equal(seeded.project.synthetic, true);
      assert.ok(seeded.records.every((r) => r.projectId === demo.id));
      console.log(
        "PASS: persistence, update, record deletion, same-project connections, repeatable synthetic seed, cross-user read/write/delete denial, cross-project relationship denial, and project-scoped retrieval.",
      );
    } finally {
      for (const id of ids) await repo.deleteProject(uid, id);
      await transaction(true, async (tx) => {
        await tx.run(
          "MATCH (u:TraceReasonUser {firebaseUid:$uid}) WHERE NOT (u)-[:OWNS]->() DELETE u",
          { uid },
        );
      });
      console.log("Temporary test records cleaned up.");
    }
  }
}
main()
  .catch(() => {
    console.error(
      "Neo4j check failed. Check the server URI, database, credentials, network access, and Aura availability. No credentials or raw errors were logged.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getDriver().close();
    } catch {}
  });
