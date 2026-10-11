"use client";
import {
  ArrowUpRight,
  FileText,
  Link2,
  Check,
  TriangleAlert,
} from "lucide-react";
import { type Answer, type Retrieved } from "@/lib/retrieval";
import { label } from "@/lib/model";
export interface Explanation {
  answer: Answer;
  context: Retrieved;
  source: "gemini" | "local";
}
export function AnswerView({
  result,
  onSelect,
}: {
  result: Explanation;
  onSelect: (id: string) => void;
}) {
  const { answer, context } = result;
  function references(recordIds: string[], evidenceIds: string[]) {
    return (
      <div className="citations">
        {[...new Set([...recordIds, ...evidenceIds])].map((id) => {
          const record = context.records.find((r) => r.id === id);
          return record ? (
            <button
              key={id}
              className={`citation ${record.kind === "Evidence" ? "is-evidence" : ""}`}
              onClick={() => onSelect(id)}
            >
              <FileText size={12} aria-hidden="true" />
              {label(record)}
              <ArrowUpRight size={12} aria-hidden="true" />
            </button>
          ) : null;
        })}
      </div>
    );
  }
  return (
    <article className="answer-view">
      <div className="answer-source">
        <span className="status-dot" />
        {result.source === "local"
          ? "LOCAL DEMO · SCRIPTED EXPLANATION"
          : "GEMINI · RETRIEVED PROJECT CONTEXT"}
      </div>
      <h2>
        A past change.
        <br />A useful lead.
      </h2>
      <p className="answer-summary">{answer.summary}</p>
      <section>
        <h3>
          <FileText size={15} aria-hidden="true" /> Documented Facts
        </h3>
        {answer.facts.map((fact, i) => (
          <div className="fact" key={i}>
            <p>{fact.text}</p>
            {references(fact.recordIds, fact.evidenceIds)}
          </div>
        ))}
      </section>
      <section className="hypothesis">
        <h3>
          <Link2 size={15} aria-hidden="true" /> Possible Connection
        </h3>
        <span className="tag">HYPOTHESIS</span>
        <p>{answer.connection.text}</p>
        {references(answer.connection.recordIds, answer.connection.evidenceIds)}
      </section>
      <section>
        <h3>
          <Check size={15} aria-hidden="true" /> Recommended Checks
        </h3>
        <ol className="checks">
          {answer.checks.map((check, i) => (
            <li key={i}>{check}</li>
          ))}
        </ol>
      </section>
      <section className="uncertainty">
        <h3>
          <TriangleAlert size={15} aria-hidden="true" /> Missing Evidence &
          Uncertainty
        </h3>
        <p>{answer.uncertainty}</p>
      </section>
      <details className="retrieval-details">
        <summary>Inspect retrieved context</summary>
        <p>
          Search matched {context.seedIds.length} records, then expanded up to 3
          graph steps. {context.records.length} records and{" "}
          {context.relationships.length} connections were included.
          {context.truncated
            ? " Context was limited to fit the retrieval budget."
            : ""}
        </p>
        <div className="citations">
          {context.records.map((r) => (
            <button
              key={r.id}
              className="citation"
              onClick={() => onSelect(r.id)}
            >
              {r.kind} · {label(r)}
            </button>
          ))}
        </div>
      </details>
    </article>
  );
}
