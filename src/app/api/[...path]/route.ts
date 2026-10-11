import { z } from "zod";
import { identity } from "@/lib/server/auth";
import { body, failure } from "@/lib/server/http";
import { AppError } from "@/lib/server/errors";
import * as repo from "@/lib/server/repository";
import { projectInput, recordInput, relationshipInput } from "@/lib/model";
import { retrieve } from "@/lib/retrieval";
import { explain, limitQuestions } from "@/lib/server/gemini";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const uid = await identity(request);
    const { path } = await context.params;
    const [root, projectId, resource, recordId] = path;
    const method = request.method;
    if (root === "seed" && path.length === 1 && method === "POST")
      return Response.json(await repo.seed(uid), { status: 201 });
    if (root !== "projects") throw new AppError(404, "API endpoint not found.");
    if (!projectId) {
      if (method === "GET") return Response.json(await repo.listProjects(uid));
      if (method === "POST")
        return Response.json(
          await repo.createProject(
            uid,
            projectInput.parse(await body(request)),
          ),
          { status: 201 },
        );
    }
    if (!projectId || projectId.length > 100 || path.length > 4)
      throw new AppError(400, "Invalid project request.");
    if (!resource) {
      if (method === "GET")
        return Response.json(await repo.snapshot(uid, projectId));
      if (method === "PATCH") {
        await repo.updateProject(
          uid,
          projectId,
          projectInput.parse(await body(request)),
        );
        return Response.json({ ok: true });
      }
      if (method === "DELETE") {
        await repo.deleteProject(uid, projectId);
        return Response.json({ ok: true });
      }
    }
    if (resource === "records") {
      if (method === "POST" && !recordId)
        return Response.json(
          await repo.saveRecord(
            uid,
            projectId,
            recordInput.parse(await body(request)),
          ),
          { status: 201 },
        );
      if (method === "PATCH" && recordId)
        return Response.json(
          await repo.saveRecord(
            uid,
            projectId,
            recordInput.parse(await body(request)),
            recordId,
          ),
        );
      if (method === "DELETE" && recordId) {
        await repo.deleteRecord(uid, projectId, recordId);
        return Response.json({ ok: true });
      }
    }
    if (resource === "relationships") {
      if (method === "POST" && !recordId)
        return Response.json(
          await repo.createRelationship(
            uid,
            projectId,
            relationshipInput.parse(await body(request)),
          ),
          { status: 201 },
        );
      if (method === "DELETE" && recordId) {
        await repo.deleteRelationship(uid, projectId, recordId);
        return Response.json({ ok: true });
      }
    }
    if (resource === "ask" && !recordId && method === "POST") {
      const { question } = z
        .object({ question: z.string().trim().min(5).max(2000) })
        .strict()
        .parse(await body(request));
      const data = await repo.snapshot(uid, projectId);
      limitQuestions(uid);
      const context = retrieve(data, question);
      return Response.json({
        answer: await explain(question, context),
        context,
        source: "gemini",
      });
    }
    throw new AppError(405, "This operation is not supported.");
  } catch (error) {
    return failure(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
