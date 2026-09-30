import { timeAgo } from "@/lib/format";

export type ReviewRow = {
  id: string;
  decision: "REQUEST_CHANGES" | "REJECTED" | "RESUBMITTED";
  message: string;
  actor: string;
  seenAt: Date | string | null;
  createdAt: Date | string;
};

function pill(decision: ReviewRow["decision"]): { label: string; cls: string } {
  switch (decision) {
    case "REJECTED":
      return { label: "Rejected", cls: "bg-red-100 text-red-800" };
    case "RESUBMITTED":
      return { label: "Resubmitted", cls: "bg-blue-100 text-trader" };
    default:
      return { label: "Changes requested", cls: "bg-amber-100 text-amber-800" };
  }
}

export default function ReviewThread({ reviews }: { reviews: ReviewRow[] }): JSX.Element {
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-500">No feedback yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {reviews.map((r) => {
        const p = pill(r.decision);
        return (
          <li key={r.id} className="rounded border border-line bg-lot/60 p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-bold ${p.cls}`}>{p.label}</span>
              <span className="text-gray-500">{r.decision === "RESUBMITTED" ? r.actor : `Reviewer`} · {timeAgo(r.createdAt)}</span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{r.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
