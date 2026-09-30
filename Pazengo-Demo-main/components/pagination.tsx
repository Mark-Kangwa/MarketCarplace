import Link from "next/link";

function pageWindow(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  return Array.from(set).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export default function Pagination({
  safePage,
  totalPages,
  pageHref
}: {
  safePage: number;
  totalPages: number;
  pageHref: (p: number) => string;
}): JSX.Element | null {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      {safePage > 1 ? (
        <Link href={pageHref(safePage - 1)} className="rounded border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-lot">← Prev</Link>
      ) : null}
      {pageWindow(safePage, totalPages).map((p, i, arr) => (
        <span key={p} className="inline-flex items-center gap-1.5">
          {i > 0 && p - arr[i - 1] > 1 ? <span className="text-gray-400">…</span> : null}
          {p === safePage ? (
            <span aria-current="page" className="rounded bg-asphalt px-3 py-1.5 text-sm font-bold text-white">{p}</span>
          ) : (
            <Link href={pageHref(p)} className="rounded border border-line bg-white px-3 py-1.5 text-sm hover:bg-lot">{p}</Link>
          )}
        </span>
      ))}
      {safePage < totalPages ? (
        <Link href={pageHref(safePage + 1)} className="rounded border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-lot">Next →</Link>
      ) : null}
    </nav>
  );
}
