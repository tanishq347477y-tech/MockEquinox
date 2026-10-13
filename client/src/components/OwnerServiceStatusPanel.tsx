import {
  Activity,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  LoaderCircle,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type State = "ready" | "not_configured" | "degraded";
type Service = {
  key: string;
  label: string;
  state: State;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
};

const stateStyles: Record<
  State,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  ready: {
    label: "Ready",
    className: "border-[#bbf2d5]/30 bg-[#bbf2d5]/10 text-[#d8ffe6]",
    icon: CheckCircle2,
  },
  not_configured: {
    label: "Not configured",
    className: "border-[#f3ca85]/30 bg-[#f3ca85]/10 text-[#f7e0a9]",
    icon: CircleDashed,
  },
  degraded: {
    label: "Degraded",
    className: "border-[#ffd0c8]/35 bg-[#ffebe8]/10 text-[#ffe5df]",
    icon: CircleAlert,
  },
};

export function OwnerServiceStatusPanel() {
  const configured = trpc.ownerConsole.services.configured.useQuery();
  const [probed, setProbed] = useState<Service[] | null>(null);
  const probe = trpc.ownerConsole.services.probe.useMutation({
    onSuccess: result => {
      setProbed(result);
      toast.success("Service probes completed");
    },
    onError: error =>
      toast.error("Service probe failed", { description: error.message }),
  });
  const services = probed ?? configured.data ?? [];
  const readyCount = services.filter(item => item.state === "ready").length;

  return (
    <section className="mt-8" aria-labelledby="service-status-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3ca85]">
            Production readiness
          </p>
          <h2
            id="service-status-title"
            className="mt-2 font-display text-4xl tracking-[-0.05em] text-white"
          >
            Know what is connected.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8bbbd]">
            These checks run on the server and never reveal keys. Probes are
            read-only: Razorpay does not create an order, storage does not write
            an object, and AI receives no prompt.
          </p>
        </div>
        <button
          onClick={() => {
            setProbed(null);
            probe.mutate();
          }}
          disabled={probe.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-[#d5e5e6] hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${probe.isPending ? "animate-spin" : ""}`}
          />
          {probe.isPending ? "Probing…" : "Run probes"}
        </button>
      </div>
      {configured.isLoading && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d2029] p-6 text-sm text-[#a8bbbd]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading server configuration summary…
        </div>
      )}
      {configured.isError && (
        <div className="mt-6 rounded-xl border border-[#ffd0c8]/35 bg-[#2a1717] p-6 text-sm text-[#ffd6cf]">
          Service configuration could not be loaded: {configured.error.message}
        </div>
      )}
      {!configured.isLoading && !configured.isError && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0d2029] p-4">
            <ServerCog className="size-5 text-[#f3ca85]" />
            <p className="text-sm text-[#c3d4d5]">
              <strong className="text-white">
                {readyCount}/{services.length || 4}
              </strong>{" "}
              services currently report ready configuration.
            </p>
            <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-[#7f9498]">
              {probed ? "Live probe result" : "Configuration summary"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {services.map(service => {
              const visual = stateStyles[service.state];
              const Icon = visual.icon;
              return (
                <article
                  key={service.key}
                  className="rounded-xl border border-white/10 bg-[#0d2029] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Activity className="size-4 text-[#f3ca85]" />
                      <h3 className="text-sm font-semibold text-white">
                        {service.label}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${visual.className}`}
                    >
                      <Icon className="size-3" />
                      {visual.label}
                    </span>
                  </div>
                  <p className="mt-4 min-h-12 text-xs leading-5 text-[#a8bbbd]">
                    {service.detail}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2 text-[10px] text-[#728b8e]">
                    <span>
                      {new Date(service.checkedAt).toLocaleTimeString()}
                    </span>
                    {service.latencyMs === undefined ? (
                      <span>Config only</span>
                    ) : (
                      <span>{service.latencyMs} ms</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
