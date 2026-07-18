"use client";

import { Sent } from "~/components/ui/orion/dashboard/Sent";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

export default function SentPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <RequireConnection require="gmail">
        <Sent />
      </RequireConnection>
    </div>
  );
}
