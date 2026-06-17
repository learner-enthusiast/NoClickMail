import { Chat } from "~/components/ui/orion/dashboard/Chat";
import { SideBar } from "~/components/ui/orion/dashboard/SideBar";
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
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
