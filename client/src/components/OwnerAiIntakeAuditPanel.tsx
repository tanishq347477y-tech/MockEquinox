import React from "react";
import { FileClock, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

function label(action: string) {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, value => value.toUpperCase());
}

function summary(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  return Object.entries(metadata)
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value)
    )
    .slice(0, 5)
    .map(
      ([key, value]) =>
        `${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String(value)}`
    )
    .join(" · ");
}

export function OwnerAiIntakeAuditPanel() {
  const history = trpc.ownerConsole.audit.aiIntake.useQuery({ limit: 200 });
  return (
    <section className="mt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3ca85]">
            Owner-only AI ledger
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-[-0.05em] text-white">
            Intake trail.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8bbbd]">
            Every owner PDF upload, staging test, extraction attempt, retry,
            duplicate decision, and processing result appears here. Secrets,
            document contents, and signed URLs are excluded.
          </p>
        </div>
        <button
          onClick={() => void history.refetch()}
          disabled={history.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-[#d5e5e6] hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw
            className={`size-3.5 ${history.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>
      <div className="mt-7 overflow-hidden rounded-xl border border-white/10 bg-[#0d2029]">
        {history.isLoading && (
          <p className="p-7 text-sm text-[#a8bbbd]">
            Loading AI intake history…
          </p>
        )}
        {history.isError && (
          <p className="p-7 text-sm text-[#ffd6cf]">
            AI intake history could not be loaded: {history.error.message}
          </p>
        )}
        {history.data?.map(entry => (
          <article
            key={entry.id}
            className="flex gap-3 border-b border-white/8 p-4 last:border-0"
          >
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-[#e8b35b]/25 bg-[#e8b35b]/10 text-[#f3ca85]">
              <FileClock className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-white">
                  {label(entry.action)}
                </p>
                <time className="text-xs text-[#8ca3a6]">
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-[#b8c9ca]">
                {entry.actorName || "System"} · {entry.entityType}
                {entry.entityId ? ` #${entry.entityId}` : ""}
              </p>
              {summary(entry.metadata) && (
                <p className="mt-2 break-words text-xs leading-5 text-[#91a8aa]">
                  {summary(entry.metadata)}
                </p>
              )}
            </div>
          </article>
        ))}
        {history.data?.length === 0 && (
          <div className="p-9 text-center">
            <FileClock className="mx-auto size-5 text-[#7f9498]" />
            <p className="mt-3 text-sm font-semibold text-[#d5e5e6]">
              No AI intake events yet.
            </p>
            <p className="mt-1 text-xs leading-5 text-[#8ca3a6]">
              Owner uploads and staging smoke tests will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
