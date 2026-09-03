import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const logout = () => pickMutationState(trpc.auth.logout.useMutation());

export const me = () => pickQueryState(trpc.auth.me.useQuery());

export const getSupportedAuthenticationProviders = () =>
  pickQueryState(trpc.auth.getSupportedAuthenticationProviders.useQuery());
