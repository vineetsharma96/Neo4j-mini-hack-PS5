import { z } from "zod";

export const kinds = [
  "Component",
  "Dependency",
  "Decision",
  "Reason",
  "Bug",
  "Fix",
  "Evidence",
] as const;
export type Kind = (typeof kinds)[number];
const short = z.string().trim().max(180);
const text = z.string().trim().max(4000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v),
    "Use a valid date",
  );
const url = z.union([
  z.literal(""),
  z
    .url()
    .max(1000)
    .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS URL"),
]);
const title = short.min(1, "Enter a title");
export const recordSchemas = {
  Component: z.object({ name: title, description: text }),
  Dependency: z.object({ name: title, version: short, description: text }),
  Decision: z.object({
    title,
    description: text,
    decidedAt: date,
    alternatives: text,
    revisitConditions: text,
    status: z.enum(["active", "superseded", "proposed"]),
  }),
  Reason: z.object({ text: text.min(1, "Enter a reason") }),
  Bug: z.object({
    title,
    symptoms: text,
    errorMessage: text,
    status: z.enum(["open", "investigating", "resolved"]),
    occurredAt: date,
  }),
  Fix: z.object({
    title,
    description: text,
    appliedAt: date,
    verificationNotes: text,
    verificationStatus: z.enum(["pending", "partial", "verified"]),
  }),
  Evidence: z.object({
    type: z.enum(["note", "test", "issue", "document", "commit"]),
    title,
    url,
    excerpt: text,
    createdAt: date,
  }),
};
export const recordInput = z
  .object({
    kind: z.enum(kinds),
    fields: z.record(z.string(), z.string().max(4000)),
  })
  .strict()
  .transform((v, ctx) => {
    const fields = recordSchemas[v.kind].safeParse(v.fields);
    if (!fields.success) {
      for (const issue of fields.error.issues)
        ctx.addIssue({ ...issue, path: ["fields", ...issue.path] });
      return z.NEVER;
    }
    return { kind: v.kind, fields: fields.data as Record<string, string> };
  });
export interface MemoryRecord {
  id: string;
  projectId: string;
  kind: Kind;
  fields: Record<string, string>;
  updatedAt: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  synthetic?: boolean;
}
export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
  projectId: string;
}
export interface Snapshot {
  project: Project;
  records: MemoryRecord[];
  relationships: Relationship[];
}
export const projectInput = z
  .object({ name: title, description: text })
  .strict();
export const relationshipRules: Record<string, [Kind[], Kind[]]> = {
  DEPENDS_ON: [["Component"], ["Dependency"]],
  AFFECTS: [["Decision", "Bug"], ["Component"]],
  HAS_REASON: [["Decision"], ["Reason"]],
  INVOLVES: [["Bug"], ["Dependency"]],
  RESOLVED_BY: [["Bug"], ["Fix"]],
  MODIFIES: [["Fix"], ["Component"]],
  SUPPORTED_BY: [["Decision", "Bug", "Fix"], ["Evidence"]],
  SUPERSEDES: [["Decision"], ["Decision"]],
};
export const relationshipInput = z
  .object({
    source: z.string().min(1).max(100),
    target: z.string().min(1).max(100),
    type: z.enum(Object.keys(relationshipRules) as [string, ...string[]]),
  })
  .strict();
export const label = (r: MemoryRecord) =>
  r.fields.title || r.fields.name || r.fields.text;
export const fieldsByKind: Record<Kind, string[]> = Object.fromEntries(
  kinds.map((k) => [k, Object.keys(recordSchemas[k].shape)]),
) as Record<Kind, string[]>;
export function checkRelationship(
  projectId: string,
  source: MemoryRecord | undefined,
  target: MemoryRecord | undefined,
  type: string,
) {
  if (
    !source ||
    !target ||
    source.projectId !== projectId ||
    target.projectId !== projectId
  )
    throw new Error("Both records must belong to the selected project.");
  if (source.id === target.id) throw new Error("Choose two different records.");
  const rule = relationshipRules[type];
  if (!rule || !rule[0].includes(source.kind) || !rule[1].includes(target.kind))
    throw new Error("This relationship is not valid for these record types.");
}
