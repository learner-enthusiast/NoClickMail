import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";
export const createUserWithEmailandPassword = () => {
  return pickMutationState(trpc.auth.createUserWithEmailandPassword.useMutation());
};
export const loginUserWithEmailandPassword = () => {
  return pickMutationState(trpc.auth.loginUserWithEmailandPassword.useMutation());
};

export const refreshToken = () => {
  return pickMutationState(trpc.auth.refreshToken.useMutation());
};

export const verifyEmail = () => {
  return pickMutationState(trpc.auth.verifyEmail.useMutation());
};

export const resendVerification = () => {
  return pickMutationState(trpc.auth.resendVerification.useMutation());
};

export const forgotPassword = () => {
  return pickMutationState(trpc.auth.forgotPassword.useMutation());
};

export const resetPassword = () => {
  return pickMutationState(trpc.auth.resetPassword.useMutation());
};

export const changePassword = () => {
  return pickMutationState(trpc.auth.changePassword.useMutation());
};

export const logout = () => {
  return pickQueryState(trpc.auth.logout.useQuery());
};

export const me = () => {
  return pickQueryState(trpc.auth.me.useQuery());
};

export const getSupportedAuthenticationProviders = () => {
  return pickQueryState(trpc.auth.getSupportedAuthenticationProviders.useQuery());
};
