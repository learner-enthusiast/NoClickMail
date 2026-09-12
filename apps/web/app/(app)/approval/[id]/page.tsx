import { ApprovalDetail } from "~/components/ui/orion/approval/ApprovalDetail";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-y-auto px-4 py-10 md:px-6">
      <ApprovalDetail approvalId={id} />
    </div>
  );
}
