export type ScrollMetrics = { scrollHeight: number; scrollTop: number; clientHeight: number };

export function isNearChatBottom({ scrollHeight, scrollTop, clientHeight }: ScrollMetrics, threshold = 72) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}
