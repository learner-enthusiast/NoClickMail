import React from "react";
import { Drafts } from "~/components/ui/orion/dashboard/Drafts";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

function Page() {
  return (
    <div>
      <RequireConnection require="gmail">
        <Drafts />
      </RequireConnection>
    </div>
  );
}

export default Page;
