import { Chat } from "~/components/ui/orion/dashboard/Chat";
import { SideBar } from "~/components/ui/orion/dashboard/SideBar";
import { RealtimeSync } from "~/components/ui/orion/Realtimesync";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RealtimeSync />

      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={15} minSize={12} maxSize={25}>
          <div className="h-full overflow-y-auto">
            <SideBar />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={55} minSize={35}>
          <div className="h-full min-h-0 overflow-y-auto">{children}</div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <div className="h-full min-h-0 overflow-hidden">
            <Chat />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
}
