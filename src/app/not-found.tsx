import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="empty-state">
      <h1>This page has no trace.</h1>
      <p>The page does not exist. Return to your project memory.</p>
      <Link href="/" className="button primary">
        Return to TraceReason
      </Link>
    </main>
  );
}
