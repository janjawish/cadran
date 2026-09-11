import { Suspense } from "react";
import { WatchDetail } from "@/components/watch-detail";
export default function WatchPage() {
  return (
    <Suspense
      fallback={<div className="loading-state">Ouverture du dossier…</div>}
    >
      <WatchDetail />
    </Suspense>
  );
}
