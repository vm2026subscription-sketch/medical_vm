import { RefreshCw, ServerCrash } from "lucide-react";
import { Btn, Panel } from "@/components/kit";

export function ApiUnreachable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 text-center md:px-6">
      <Panel className="p-8">
        <ServerCrash className="mx-auto size-10 text-rose" strokeWidth={1.5} />
        <h1 className="mt-4 text-[20px]">Can't reach the MedPath API</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          The backend at{" "}
          <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">VITE_API_URL</code> didn't
          respond. Make sure the backend is running (
          <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">npm run dev</code> inside{" "}
          <code className="rounded bg-paper px-1.5 py-0.5 text-[12px]">backend/</code>) and that
          MongoDB/Redis are reachable.
        </p>
        <Btn variant="ghost" className="mt-5" onClick={onRetry ?? (() => window.location.reload())}>
          <RefreshCw className="size-4" strokeWidth={1.6} /> Retry
        </Btn>
      </Panel>
    </div>
  );
}
