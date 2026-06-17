"use client";

import { Button } from "~/components/ui/button";
import AgentTester from "~/components/ui/orion/AgentTester";
import { Chat } from "~/components/ui/orion/dashboard/Chat";
import { Inbox } from "~/components/ui/orion/dashboard/Inbox";
import { SideBar } from "~/components/ui/orion/dashboard/SideBar";

import { env } from "~/env.js";
import { connectionStatus } from "~/hooks/connections";

const API_BASE = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").replace(
  /\/trpc\/?$/,
  "",
);

const PROVIDERS = [
  { id: "gmail", label: "Gmail" },
  { id: "googlecalendar", label: "Google Calendar" },
] as const;

function Connections() {
  const { data, isPending } = connectionStatus();

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <div className="w-[15%]">
        <SideBar />
      </div>
      <div className="w-[55%]">
        <Inbox />
      </div>
      <div className="w-[30%]">
        <Chat />
      </div>
    </div>
  );
}
export default Connections;
