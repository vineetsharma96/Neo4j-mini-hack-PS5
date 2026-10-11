import { Suspense } from "react";
import Workspace from "@/components/workspace";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main" className="loading-block">
          Loading workspace…
        </main>
      }
    >
      <Workspace />
    </Suspense>
  );
}
