"use client";

import { Inbox } from "~/components/ui/orion/dashboard/Inbox";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

export default function InboxPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <RequireConnection require="gmail">
        <Inbox />
      </RequireConnection>
    </div>
  );
}
