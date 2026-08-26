/**
 * Query layer — the only place that names a query key.
 *
 * Both queries poll on a short interval: that is how a change an agent makes
 * through MCP shows up on an open board without a manual refresh.
 */

import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { getTopicFn, listTopicsFn } from "@/server/functions/grill";

/** Every topic for the sidebar. */
export const topicsQueryOptions = () =>
  queryOptions({
    queryKey: ["topics"] as const,
    queryFn: () => listTopicsFn(),
    refetchInterval: 2500,
  });

/** Full state of one topic. Resolves to `null` when the id is unknown. */
export const topicQueryOptions = (topicId: string) =>
  queryOptions({
    queryKey: ["topic", topicId] as const,
    queryFn: () => getTopicFn({ data: { topicId } }),
    refetchInterval: 2000,
  });

/**
 * Refetch what a mutation just changed: the topic list always, and the open
 * topic when one is given. Call it from `useMutation`'s `onSuccess`.
 */
export const invalidateTopicQueries = (queryClient: QueryClient, topicId?: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["topics"] }),
    ...(topicId === undefined
      ? []
      : [queryClient.invalidateQueries({ queryKey: ["topic", topicId] })]),
  ]);
