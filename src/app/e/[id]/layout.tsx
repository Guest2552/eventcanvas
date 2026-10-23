import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { EventShell } from "@/components/event/event-shell";

// Event data lives in the browser (IndexedDB), so the workspace renders on the client.
export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Loading your plan…
        </div>
      }
    >
      <EventShell>{children}</EventShell>
    </Suspense>
  );
}
