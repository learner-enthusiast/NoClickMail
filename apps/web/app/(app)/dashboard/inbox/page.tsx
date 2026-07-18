"use client";

import { Chat } from "~/components/ui/orion/dashboard/Chat";
import { Inbox } from "~/components/ui/orion/dashboard/Inbox";
import { SideBar } from "~/components/ui/orion/dashboard/SideBar";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";
import { connectionStatus } from "~/hooks/connections";

// const API_BASE = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").replace(
//   /\/trpc\/?$/,
//   "",
// );

// const PROVIDERS = [
//   { id: "gmail", label: "Gmail" },
//   { id: "googlecalendar", label: "Google Calendar" },
// ] as const;

function Connections() {
  return (
    <div className="flex min-h-full w-full">
      <RequireConnection require="gmail">
        <Inbox />
      </RequireConnection>
    </div>
  );
}
export default Connections;
