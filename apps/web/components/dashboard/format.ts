export function formatDateTime(value: string | null): string {
  if (value === null) {
    return "Not finished";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "Pending";
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  const seconds = Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

export function shortSha(value: string): string {
  return value.length <= 12 ? value : value.slice(0, 12);
}
