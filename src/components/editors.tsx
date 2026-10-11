"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Dialog } from "./dialog";
import {
  fieldsByKind,
  kinds,
  label,
  recordInput,
  projectInput,
  checkRelationship,
  relationshipRules,
  type Kind,
  type MemoryRecord,
  type Project,
} from "@/lib/model";
const fieldLabels: Record<string, string> = {
  name: "Name",
  title: "Title",
  description: "Description",
  version: "Version",
  decidedAt: "Decision date",
  alternatives: "Alternatives considered",
  revisitConditions: "Revisit conditions",
  status: "Status",
  text: "Reason",
  symptoms: "Symptoms",
  errorMessage: "Error message",
  occurredAt: "Occurrence date",
  appliedAt: "Applied date",
  verificationNotes: "Verification notes",
  verificationStatus: "Verification status",
  type: "Evidence type",
  url: "Source URL (optional)",
  excerpt: "Evidence excerpt",
  createdAt: "Evidence date",
};
const choices: Record<string, string[]> = {
  Decision: ["active", "superseded", "proposed"],
  Bug: ["open", "investigating", "resolved"],
  Fix: ["pending", "partial", "verified"],
  Evidence: ["note", "test", "issue", "document", "commit"],
};
const longFields = new Set([
  "description",
  "alternatives",
  "revisitConditions",
  "text",
  "symptoms",
  "errorMessage",
  "verificationNotes",
  "excerpt",
]);
function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
export function RecordEditor({
  record,
  onSave,
  onClose,
}: {
  record?: MemoryRecord;
  onSave: (v: { kind: Kind; fields: Record<string, string> }) => Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>(record?.kind || "Decision"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [issues, setIssues] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  useDirtyGuard(dirty);
  const close = () => {
    if (!dirty || window.confirm("Discard your unsaved record changes?"))
      onClose();
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const fields = Object.fromEntries(
      new FormData(form.current!).entries(),
    ) as Record<string, string>;
    delete fields.kind;
    const parsed = recordInput.safeParse({ kind, fields });
    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path.at(-1)), i.message]),
      );
      setIssues(errors);
      form.current
        ?.querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)
        ?.focus();
      return;
    }
    setIssues({});
    setBusy(true);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={record ? "Edit Memory Record" : "Add Memory Record"}
      onClose={close}
    >
      <form ref={form} onSubmit={submit} onChange={() => setDirty(true)}>
        <label>
          Record type
          <select
            name="kind"
            aria-label="Record type"
            value={kind}
            disabled={!!record}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <div key={kind} className="editor-fields">
          {fieldsByKind[kind].map((field) => {
            const props = {
              name: field,
              autoComplete: "off",
              defaultValue:
                record?.fields[field] ||
                (field.endsWith("At")
                  ? new Date().toISOString().slice(0, 10)
                  : ""),
              "aria-invalid": !!issues[field],
              "aria-describedby": issues[field] ? `${field}-error` : undefined,
            };
            return (
              <label key={field}>
                {fieldLabels[field]}
                {field === "status" ||
                field === "verificationStatus" ||
                (field === "type" && kind === "Evidence") ? (
                  <select
                    {...props}
                    defaultValue={record?.fields[field] || choices[kind][0]}
                  >
                    {choices[kind].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : longFields.has(field) ? (
                  <textarea
                    {...props}
                    rows={3}
                    maxLength={4000}
                    placeholder={`${fieldLabels[field]}…`}
                  />
                ) : (
                  <input
                    {...props}
                    type={
                      field.endsWith("At")
                        ? "date"
                        : field === "url"
                          ? "url"
                          : "text"
                    }
                    maxLength={field === "url" ? 1000 : 180}
                    placeholder={
                      field === "url"
                        ? "https://example.com/source…"
                        : `${fieldLabels[field]}…`
                    }
                  />
                )}
                <span className="field-error" id={`${field}-error`}>
                  {issues[field]}
                </span>
              </label>
            );
          })}
        </div>
        <div className="form-error" role="alert">
          {error}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save record"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function ProjectEditor({
  project,
  onSave,
  onClose,
}: {
  project?: Project;
  onSave: (v: { name: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useDirtyGuard(dirty);
  const close = () => {
    if (!dirty || window.confirm("Discard unsaved project changes?")) onClose();
  };
  return (
    <Dialog title={project ? "Edit Project" : "Create Project"} onClose={close}>
      <form
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = projectInput.safeParse(
            Object.fromEntries(new FormData(e.currentTarget)),
          );
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          setBusy(true);
          try {
            await onSave(parsed.data);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save. Retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Project name
          <input
            name="name"
            autoComplete="off"
            defaultValue={project?.name}
            required
            maxLength={180}
            placeholder="Your project name…"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            autoComplete="off"
            defaultValue={project?.description}
            maxLength={4000}
            rows={4}
            placeholder="What is this project for?…"
          />
        </label>
        <div className="form-error" role="alert">
          {error}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save project"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function RelationshipEditor({
  records,
  projectId,
  onSave,
  onClose,
}: {
  records: MemoryRecord[];
  projectId: string;
  onSave: (v: {
    source: string;
    target: string;
    type: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [source, setSource] = useState(records[0]?.id || ""),
    [type, setType] = useState(
      Object.keys(relationshipRules).find((type) =>
        relationshipRules[type][0].includes(records[0]?.kind),
      ) || "AFFECTS",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const targets = records.filter(
    (r) => relationshipRules[type][1].includes(r.kind) && r.id !== source,
  );
  const sourceRecord = records.find((r) => r.id === source);
  const availableTypes = Object.keys(relationshipRules).filter(
    (type) =>
      sourceRecord && relationshipRules[type][0].includes(sourceRecord.kind),
  );
  return (
    <Dialog title="Connect Two Records" onClose={onClose}>
      <p className="muted">
        A relationship records context. It does not establish causation.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const target = String(new FormData(e.currentTarget).get("target"));
          setError("");
          try {
            checkRelationship(
              projectId,
              records.find((r) => r.id === source),
              records.find((r) => r.id === target),
              type,
            );
            setBusy(true);
            await onSave({ source, target, type });
            onClose();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not connect. Retry.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Source record
          <select
            name="source"
            value={source}
            aria-label="Source record"
            onChange={(e) => {
              const id = e.target.value;
              setSource(id);
              const record = records.find((r) => r.id === id);
              if (record && !relationshipRules[type][0].includes(record.kind))
                setType(
                  Object.keys(relationshipRules).find((t) =>
                    relationshipRules[t][0].includes(record.kind),
                  )!,
                );
            }}
          >
            {records.map((r) => (
              <option value={r.id} key={r.id}>
                {r.kind} · {label(r)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Relationship
          <select
            name="type"
            aria-label="Relationship"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {availableTypes.map((type) => (
              <option value={type} key={type}>
                {type.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target record
          <select
            name="target"
            aria-label="Target record"
            key={`${type}-${source}`}
            required
          >
            {targets.map((r) => (
              <option value={r.id} key={r.id}>
                {r.kind} · {label(r)}
              </option>
            ))}
          </select>
        </label>
        {!targets.length && (
          <p className="notice">Add a compatible target record first.</p>
        )}
        <div className="form-error" role="alert">
          {error}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !targets.length}>
            {busy ? "Connecting…" : "Create relationship"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
