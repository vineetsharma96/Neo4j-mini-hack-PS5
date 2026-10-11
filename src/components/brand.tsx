import { Network } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" translate="no">
      <span className="brand-mark">
        <Network aria-hidden="true" size={23} strokeWidth={1.6} />
      </span>
      <span>TraceReason{!compact && <span className="brand-dot">.</span>}</span>
    </span>
  );
}
