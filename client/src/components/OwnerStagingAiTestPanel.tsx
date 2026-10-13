import React, { useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const sample =
  "A sufficiently detailed sample question source can be pasted here to verify that the staging AI provider returns structured multiple-choice drafts without creating questions, uploading files, or starting queue jobs.";

export function OwnerStagingAiTestPanel() {
  const [sourceText, setSourceText] = useState("");
  const testExtract = trpc.ownerConsole.intake.testExtract.useMutation();
  const run = () =>
    testExtract.mutate(
      { sourceText },
      {
        onSuccess: result =>
          toast.success(
            `Staging extraction returned ${result.processed} draft${result.processed === 1 ? "" : "s"}.`,
            {
              description: `${result.latencyMs} ms · no database or queue writes`,
            }
          ),
        onError: error =>
          toast.error("Staging AI test did not run", {
            description: error.message,
          }),
      }
    );
  return (
    <section className="mt-2 max-w-4xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3ca85]">
        Owner-only staging tool
      </p>
      <h2 className="mt-2 font-display text-4xl tracking-[-0.05em] text-white">
        Test the AI safely.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8bbbd]">
        Use this before enabling production AI credentials. It runs only when{" "}
        <code className="text-[#f3ca85]">STAGING_AI_TEST_MODE=true</code> and{" "}
        <code className="text-[#f3ca85]">NODE_ENV</code> is not production.
      </p>
      <div className="mt-6 rounded-xl border border-[#e8b35b]/30 bg-[#171b18] p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#e8b35b]/30 bg-[#e8b35b]/10 text-[#f3ca85]">
            <FlaskConical className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              No-write extraction smoke test
            </p>
            <p className="mt-1 text-xs leading-5 text-[#b8c9ca]">
              This test does not upload a file, create a question, create a
              queue job, or publish content. It records only a safe audit event.
            </p>
          </div>
        </div>
        <textarea
          value={sourceText}
          onChange={event => setSourceText(event.target.value)}
          className="mt-5 min-h-40 w-full rounded-lg border border-white/15 bg-[#07171f] px-3 py-2 text-sm text-white outline-none placeholder:text-[#759095] focus:border-[#e8b35b]"
          placeholder={sample}
          maxLength={30_000}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#8fa5a7]">
            {sourceText.length.toLocaleString()} / 30,000 characters · minimum
            80
          </p>
          <button
            onClick={run}
            disabled={testExtract.isPending || sourceText.trim().length < 80}
            className="inline-flex items-center gap-2 rounded-lg bg-[#e8b35b] px-3 py-2.5 text-xs font-semibold text-[#172026] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck className="size-3.5" />
            {testExtract.isPending ? "Testing provider…" : "Run staging test"}
          </button>
        </div>
        {testExtract.data && (
          <div className="mt-5 rounded-lg border border-[#a8e3bb]/25 bg-[#173b2b]/40 p-4">
            <p className="text-sm font-semibold text-[#c9f3d5]">
              No-write test completed · {testExtract.data.processed} draft(s)
            </p>
            <p className="mt-1 text-xs text-[#b8d9c0]">
              Provider latency: {testExtract.data.latencyMs} ms. Review the
              returned structure below; nothing was persisted.
            </p>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/20 p-3 text-xs leading-5 text-[#d8eee0]">
              {JSON.stringify(testExtract.data.questions, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
