import {
  Activity,
  ArrowLeft,
  Database,
  FileClock,
  FileUp,
  FlaskConical,
  History,
  LayoutDashboard,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import {
  OwnerCatalogPanel,
  OwnerContentPanel,
  OwnerUsersPanel,
} from "@/components/OwnerManagement";
import { OwnerIntakePanel } from "@/components/OwnerIntake";
import { OwnerAuditLogPanel } from "@/components/OwnerAuditLog";
import { OwnerAiIntakeAuditPanel } from "@/components/OwnerAiIntakeAuditPanel";
import { OwnerStagingAiTestPanel } from "@/components/OwnerStagingAiTestPanel";
import { OwnerServiceStatusPanel } from "@/components/OwnerServiceStatusPanel";

type Section =
  | "overview"
  | "services"
  | "intake"
  | "ai-audit"
  | "staging-ai"
  | "content"
  | "catalogue"
  | "users"
  | "activity";

export function OwnerConsole({
  name,
  onNavigate,
}: {
  name?: string;
  onNavigate: (route: "dashboard" | "profile" | "student") => void;
}) {
  const [section, setSection] = useState<Section>(() => {
    const requested = import.meta.env.DEV
      ? new URLSearchParams(window.location.search).get("qaOwnerSection")
      : undefined;
    return requested === "services" ||
      requested === "intake" ||
      requested === "ai-audit" ||
      requested === "staging-ai" ||
      requested === "content" ||
      requested === "catalogue" ||
      requested === "users" ||
      requested === "activity"
      ? requested
      : "overview";
  });
  const navigation: Array<{
    id: Section;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "services", label: "Service status", icon: Activity },
    { id: "intake", label: "Source intake", icon: FileUp },
    { id: "ai-audit", label: "AI intake audit", icon: FileClock },
    { id: "staging-ai", label: "Staging AI test", icon: FlaskConical },
    { id: "content", label: "Question bank", icon: Database },
    { id: "catalogue", label: "Exam catalogue", icon: ShieldCheck },
    { id: "users", label: "User access", icon: UsersRound },
    { id: "activity", label: "Activity log", icon: History },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#071218] text-[#eef8f7]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0a171f]/95 px-5 py-4 backdrop-blur sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="font-display text-2xl tracking-[-0.05em] text-white"
          >
            MockE
          </button>
          <span className="whitespace-nowrap rounded-md border border-[#e8b35b]/35 bg-[#e8b35b]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f3ca85]">
            Owner console
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AccessibilityControls />
          <button
            onClick={() => onNavigate("profile")}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            {name || "Owner profile"}
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0a171f] p-4 lg:min-h-[calc(100vh-65px)] lg:border-b-0 lg:border-r">
          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7f9498]">
            Management
          </p>
          <nav
            className="mt-3 flex max-w-full gap-2 overflow-x-auto lg:block lg:space-y-1"
            aria-label="Owner Console sections"
          >
            {navigation.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition lg:w-full ${section === item.id ? "bg-[#e8b35b] text-[#172026]" : "text-[#bed0d1] hover:bg-white/8 hover:text-white"}`}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 rounded-xl border border-white/10 bg-[#0e202a] p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7f9498]">
              Access boundary
            </p>
            <p className="mt-2 text-sm font-semibold text-[#d4f3e1]">
              Project-owner only
            </p>
            <p className="mt-1 text-xs leading-5 text-[#92a9ab]">
              User, hierarchy, question, and connection checks are audited and
              restricted to this console.
            </p>
          </div>
          <button
            onClick={() => onNavigate("student")}
            className="mt-5 inline-flex items-center gap-2 px-3 text-xs font-semibold text-[#a7bcbe] hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Open learner desk
          </button>
        </aside>
        <main className="min-w-0 p-5 sm:p-7 lg:p-9">
          {section === "overview" && <OwnerOverview onOpen={setSection} />}
          {section === "services" && <OwnerServiceStatusPanel />}
          {section === "intake" && <OwnerIntakePanel />}
          {section === "ai-audit" && <OwnerAiIntakeAuditPanel />}
          {section === "staging-ai" && <OwnerStagingAiTestPanel />}
          {section === "content" && <OwnerContentPanel />}
          {section === "catalogue" && <OwnerCatalogPanel />}
          {section === "users" && <OwnerUsersPanel />}
          {section === "activity" && <OwnerAuditLogPanel />}
        </main>
      </div>
    </div>
  );
}

function OwnerOverview({ onOpen }: { onOpen: (section: Section) => void }) {
  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3ca85]">
        Owner workspace
      </p>
      <h1 className="mt-3 max-w-4xl font-display text-5xl leading-[0.94] tracking-[-0.05em] text-white sm:text-6xl">
        Manage the platform without entering the learner experience.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#afc2c4]">
        Use dedicated controls for source intake, account roles, the exam
        hierarchy, versioned mock-test questions, and production connections.
        Every server action is restricted to the configured project owner and
        writes an audit event.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <button
          onClick={() => onOpen("services")}
          className="rounded-xl border border-[#f3ca85]/35 bg-[#0d2029] p-6 text-left hover:border-[#e8b35b]/75"
        >
          <Activity className="size-5 text-[#f3ca85]" />
          <h2 className="mt-5 font-display text-3xl text-white">
            Service status
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#a8bbbd]">
            Check payment, storage, AI, and email connections without exposing
            keys.
          </p>
        </button>
        <button
          onClick={() => onOpen("intake")}
          className="rounded-xl border border-white/10 bg-[#0d2029] p-6 text-left hover:border-[#e8b35b]/55"
        >
          <FileUp className="size-5 text-[#f3ca85]" />
          <h2 className="mt-5 font-display text-3xl text-white">
            Source intake
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#a8bbbd]">
            Turn source PDFs or structured JSON into reviewable question drafts.
          </p>
        </button>
        <button
          onClick={() => onOpen("users")}
          className="rounded-xl border border-white/10 bg-[#0d2029] p-6 text-left hover:border-[#e8b35b]/55"
        >
          <UsersRound className="size-5 text-[#f3ca85]" />
          <h2 className="mt-5 font-display text-3xl text-white">User access</h2>
          <p className="mt-2 text-sm leading-6 text-[#a8bbbd]">
            Review real accounts and assign learner, reviewer, or administrator
            roles.
          </p>
        </button>
        <button
          onClick={() => onOpen("catalogue")}
          className="rounded-xl border border-white/10 bg-[#0d2029] p-6 text-left hover:border-[#e8b35b]/55"
        >
          <ShieldCheck className="size-5 text-[#f3ca85]" />
          <h2 className="mt-5 font-display text-3xl text-white">
            Exam catalogue
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#a8bbbd]">
            Create the exam, subject, and topic structure behind your content.
          </p>
        </button>
        <button
          onClick={() => onOpen("content")}
          className="rounded-xl border border-white/10 bg-[#0d2029] p-6 text-left hover:border-[#e8b35b]/55"
        >
          <Database className="size-5 text-[#f3ca85]" />
          <h2 className="mt-5 font-display text-3xl text-white">
            Question bank
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#a8bbbd]">
            Create, version, publish, and archive real exam questions.
          </p>
        </button>
      </div>
    </section>
  );
}
