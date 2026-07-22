export const pickMutationState = <
  T extends {
    mutateAsync: T["mutateAsync"];
    mutate: T["mutate"];
    reset: T["reset"];
    data: T["data"];
    error: T["error"];
    failureCount: T["failureCount"];
    isError: T["isError"];
    isIdle: T["isIdle"];
    isSuccess: T["isSuccess"];
    status: T["status"];
  },
>(
  mutation: T,
) => {
  const {
    mutateAsync,
    mutate,
    reset,
    data,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  } = mutation;

  return {
    mutateAsync,
    mutate,
    reset,
    data,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  };
};

export const pickQueryState = <
  T extends {
    data: T["data"];
    error: T["error"];
    failureCount: T["failureCount"];
    isError: T["isError"];
    isFetching: T["isFetching"];
    isPending: T["isPending"];
    isSuccess: T["isSuccess"];
    refetch: T["refetch"];
    status: T["status"];
  },
>(
  query: T,
) => {
  const { data, error, failureCount, isError, isFetching, isPending, isSuccess, refetch, status } =
    query;

  return {
    data,
    error,
    failureCount,
    isError,
    isFetching,
    isPending,
    isSuccess,
    refetch,
    status,
  };
};
