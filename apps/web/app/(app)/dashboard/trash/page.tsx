"use client";

import { Trash } from "~/components/ui/orion/dashboard/Trash";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

export default function TrashPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <RequireConnection require="gmail">
        <Trash />
      </RequireConnection>
    </div>
  );
}
