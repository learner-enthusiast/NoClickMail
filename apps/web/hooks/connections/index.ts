import { pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const connectionStatus = () => pickQueryState(trpc.connections.status.useQuery());
