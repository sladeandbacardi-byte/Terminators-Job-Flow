export const CANONICAL_WORKER_NAMES = {
  "worker-6": "Anzel Marais",
} as const;

export function getCanonicalWorkerName(workerId: string): string | undefined {
  return CANONICAL_WORKER_NAMES[workerId as keyof typeof CANONICAL_WORKER_NAMES];
}