import { ApprovalDetail } from "~/components/ui/orion/approval/ApprovalDetail";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10 md:px-6">
      <ApprovalDetail approvalId={id} />
    </div>
  );
}
