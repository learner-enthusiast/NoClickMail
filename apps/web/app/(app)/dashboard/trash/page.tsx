"use client";

import { Trash } from "~/components/ui/orion/dashboard/Trash";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

export default function TrashPage() {
  return (
    <div className="">
      <RequireConnection require="gmail">
        <Trash />
      </RequireConnection>
    </div>
  );
}
