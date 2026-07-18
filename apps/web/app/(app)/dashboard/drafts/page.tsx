"use client";

import { Drafts } from "~/components/ui/orion/dashboard/Drafts";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

export default function DraftsPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <RequireConnection require="gmail">
        <Drafts />
      </RequireConnection>
    </div>
  );
}
