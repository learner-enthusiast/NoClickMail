import { Chat } from "~/components/ui/orion/dashboard/Chat";
import { SideBar } from "~/components/ui/orion/dashboard/SideBar";
import { RealtimeSync } from "~/components/ui/orion/Realtimesync";

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <RealtimeSync />
      <div className="w-[15%]">
        <SideBar />
      </div>
      <div className="w-[55%]">{children}</div>
      <div className="w-[30%]">
        <Chat />
      </div>
    </div>
  );
}
