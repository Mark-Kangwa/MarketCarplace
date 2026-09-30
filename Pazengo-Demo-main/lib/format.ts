export function zmw(n: number): string {
  return "K " + n.toLocaleString("en-ZM").replace(/,/g, " ");
}

/** @deprecated Use zmw() instead. Kept for backwards compatibility. */
export function zar(n: number): string {
  return zmw(n);
}

export function km(n: number): string {
  return n.toLocaleString("en-ZA") + " km";
}

export function timeAgo(d: Date | string): string {
  const t = new Date(d).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
