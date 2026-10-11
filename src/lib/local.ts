import { z } from "zod";
import { kinds, recordInput, type Snapshot } from "./model";
import { makeDemo } from "./demo";
const stored = z
  .array(
    z.object({
      project: z.object({
        id: z.string(),
        name: z.string().max(180),
        description: z.string().max(4000),
        createdAt: z.string(),
        updatedAt: z.string(),
        synthetic: z.boolean().optional(),
      }),
      records: z
        .array(
          z.object({
            id: z.string(),
            projectId: z.string(),
            kind: z.enum(kinds),
            fields: z.record(z.string(), z.string()),
            updatedAt: z.string(),
          }),
        )
        .max(500),
      relationships: z
        .array(
          z.object({
            id: z.string(),
            source: z.string(),
            target: z.string(),
            type: z.string(),
            projectId: z.string(),
          }),
        )
        .max(2000),
    }),
  )
  .max(100);
export const localKey = "tracereason.demo.v1";
export function loadLocal(): Snapshot[] {
  const raw = localStorage.getItem(localKey);
  if (!raw) return [makeDemo()];
  const data = stored.parse(JSON.parse(raw));
  for (const snapshot of data) {
    for (const r of snapshot.records) {
      recordInput.parse({ kind: r.kind, fields: r.fields });
      if (r.projectId !== snapshot.project.id)
        throw new Error("Invalid demo project data.");
    }
  }
  return data;
}
export function saveLocal(data: Snapshot[]) {
  localStorage.setItem(localKey, JSON.stringify(data));
}
