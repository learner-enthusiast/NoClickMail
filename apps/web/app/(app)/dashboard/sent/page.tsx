import React from "react";
import { Sent } from "~/components/ui/orion/dashboard/Sent";
import { RequireConnection } from "~/components/ui/orion/glitches/RequireConnection";

function Page() {
  return (
    <div>
      <RequireConnection require="gmail">
        <Sent />
      </RequireConnection>
    </div>
  );
}

export default Page;
