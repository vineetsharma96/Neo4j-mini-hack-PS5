import { ZodError } from "zod";
import { AppError } from "./errors";
export async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "Send JSON with Content-Type: application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "A JSON request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24000) {
        await reader.cancel();
        throw new AppError(
          413,
          "This request is too large. Keep records under 24 KB.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "The request body must be valid JSON.");
  }
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "Check the highlighted fields.",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  // Never return raw SDK errors, query parameters, credentials or provider response bodies.
  return Response.json(
    {
      error:
        "The project service could not complete this request. Check server configuration and connectivity, then retry.",
    },
    { status: 503 },
  );
}
