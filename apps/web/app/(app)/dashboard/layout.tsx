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

      <ResizablePanelGroup direction="horizontal" className="min-h-screen w-full">
        <ResizablePanel defaultSize={15} minSize={12} maxSize={25}>
          <SideBar />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={55} minSize={35}>
          {children}
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <Chat />
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
}
