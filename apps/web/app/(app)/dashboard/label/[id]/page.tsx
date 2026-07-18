"use client";

import { use } from "react";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";
import { LabelMail } from "~/components/ui/orion/dashboard/LabelMail";

export default function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const labelId = decodeURIComponent(id);

  return (
    <div className="h-full min-h-0 w-full">
      <RequireConnection require="gmail">
        <LabelMail labelId={labelId} />
      </RequireConnection>
    </div>
  );
}
