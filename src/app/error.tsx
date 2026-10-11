"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="empty-state">
      <h1>This view could not load.</h1>
      <p>Retry the view, or return to TraceReason.</p>
      <button className="button primary" onClick={reset}>
        Retry
      </button>
      <Link href="/" className="quiet-link">
        Return home
      </Link>
    </main>
  );
}
