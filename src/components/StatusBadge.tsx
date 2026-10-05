import { STATUS_COLOR, STATUS_LABEL } from "@/lib/plans";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_COLOR[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
