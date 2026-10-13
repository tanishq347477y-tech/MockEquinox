import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  completeLogout,
  displayAccountState,
  ownerOnlyRouteRedirect,
  protectedRouteRedirect,
  readQaAccountOverride,
} from "@/lib/accessNavigation";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import {
  Profile,
  StudentDashboard,
  StudyLanding as MainStudyLanding,
  StudyLogin,
} from "@/components/StudyExperience";
import { MonthlyPricing } from "@/components/MonthlyPricing";
import {
  MonthlyExamLibrary,
  MonthlyPurchases,
} from "@/components/MonthlyAccessViews";
import { OwnerConsole } from "@/components/OwnerConsole";
import { AuthPanel } from "@/components/AuthPanel";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  FileUp,
  Flag,
  Layers3,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Screen =
  | "dashboard"
  | "login"
  | "student"
  | "exams"
  | "pricing"
  | "purchases"
  | "profile"
  | "admin"
  | "instructions"
  | "test"
  | "results"
  | "operations"
  | "plans";
const validScreens = new Set<Screen>([
  "dashboard",
  "login",
  "student",
  "exams",
  "pricing",
  "purchases",
  "profile",
  "admin",
  "instructions",
  "test",
  "results",
  "operations",
]);

function initialScreen(): Screen {
  const rawHash = window.location.hash.slice(1);
  if (rawHash === "plans") return "pricing";
  const hash = rawHash as Screen;
  return validScreens.has(hash) ? hash : "dashboard";
}

const questions = [
  {
    id: 1,
    subject: "Physics",
    topic: "Kinematics",
    text: "A particle moves with a constant acceleration of 2 m/s². If its initial velocity is 4 m/s, what is its velocity after 5 seconds?",
    options: ["8 m/s", "10 m/s", "14 m/s", "20 m/s"],
    answer: 2,
  },
  {
    id: 2,
    subject: "Chemistry",
    topic: "Atomic Structure",
    text: "Which quantum number principally determines the shape of an atomic orbital?",
    options: [
      "Principal quantum number",
      "Azimuthal quantum number",
      "Magnetic quantum number",
      "Spin quantum number",
    ],
    answer: 1,
  },
  {
    id: 3,
    subject: "Mathematics",
    topic: "Calculus",
    text: "If f(x) = x³ − 3x, then f′(2) is equal to:",
    options: ["3", "6", "9", "12"],
    answer: 2,
  },
  {
    id: 4,
    subject: "Physics",
    topic: "Current Electricity",
    text: "Two identical resistors are connected in parallel. Their equivalent resistance is:",
    options: [
      "Half the value of either resistor",
      "The same as either resistor",
      "Twice the value of either resistor",
      "Zero",
    ],
    answer: 0,
  },
];

const numberTiles = Array.from({ length: 20 }, (_, i) => i + 1);
const portablePageVideoUrl = `${(import.meta.env.VITE_MEDIA_BASE_URL || "/media").replace(/\/$/, "")}/mocke-study-pages.mp4`;

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="MockEquinox">
      <div className="grid size-9 place-items-center rounded-xl bg-[#1c3475] text-white shadow-[0_8px_20px_rgba(28,52,117,0.22)]">
        <Command className="size-[18px]" strokeWidth={2.4} />
      </div>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.04em] text-[#152449]">
          MockEquinox
        </span>
      )}
    </div>
  );
}

function SmallPill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const styles = {
    blue: "bg-[#edf4ff] text-[#2856a8] ring-[#d8e7ff]",
    green: "bg-[#eaf8f0] text-[#18724b] ring-[#cfefd9]",
    amber: "bg-[#fff6e0] text-[#9a6409] ring-[#fae8b6]",
    slate: "bg-[#f2f5f9] text-[#5b6881] ring-[#e4e9f0]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function StudyLanding({
  onBegin,
  onNavigate,
  isAuthenticated,
}: {
  onBegin: () => void;
  onNavigate: (screen: Screen) => void;
  isAuthenticated: boolean;
}) {
  return (
    <div className="study-hero min-h-screen overflow-hidden bg-[#003447] text-white">
      <video
        className="absolute inset-0 size-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source
          src={`${(import.meta.env.VITE_MEDIA_BASE_URL || "/media").replace(/\/$/, "")}/mocke-study-hero.mp4`}
          type="video/mp4"
        />
      </video>
      <nav
        className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6"
        aria-label="MockEquinox landing navigation"
      >
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="font-display text-[28px] tracking-[-0.05em] text-white"
        >
          MockE
          <sup className="ml-0.5 align-super font-sans text-[9px] tracking-normal">
            ®
          </sup>
        </button>
        <div className="hidden items-center gap-7 md:flex">
          <button
            onClick={() => onNavigate("instructions")}
            className="text-sm text-white/65 transition hover:text-white"
          >
            Study plan
          </button>
          <button
            onClick={onBegin}
            className="text-sm text-white/65 transition hover:text-white"
          >
            Mock tests
          </button>
          <button
            onClick={() => onNavigate("plans")}
            className="text-sm text-white/65 transition hover:text-white"
          >
            Access
          </button>
        </div>
        <button
          onClick={onBegin}
          className="liquid-glass rounded-full px-4 py-2 text-sm font-medium text-white sm:px-5"
        >
          {isAuthenticated ? "Continue studying" : "Start studying"}
        </button>
      </nav>
      <main className="relative z-10 flex min-h-[calc(100vh-82px)] flex-col items-center justify-center px-5 pb-28 pt-20 text-center sm:px-8 sm:pt-24">
        <p className="animate-fade-rise rounded-full border border-white/20 bg-white/[0.01] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.19em] text-white/65">
          MockEquinox · focused exam preparation
        </p>
        <h1 className="animate-fade-rise mt-7 max-w-6xl font-display text-[52px] font-normal leading-[0.93] tracking-[-0.055em] text-white sm:text-7xl md:text-8xl">
          Study with <em className="not-italic text-white/55">purpose.</em>
          <br />
          Test with <em className="not-italic text-white/55">clarity.</em>
        </h1>
        <p className="animate-fade-rise-delay mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
          Focused practice, timed mocks, and the feedback you need to turn quiet
          study hours into calm exam-day decisions.
        </p>
        <button
          onClick={onBegin}
          className="liquid-glass animate-fade-rise-delay-2 mt-10 rounded-full px-10 py-4 text-base font-medium text-white sm:px-14 sm:py-5"
        >
          Take a mock <ArrowRight className="ml-2 inline size-4" />
        </button>
      </main>
      <div className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-5 pb-7 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-white/50 sm:justify-between sm:px-8">
        <span>JEE Main 2026</span>
        <span>Focused practice</span>
        <span>Timed mock tests</span>
        <span>Honest progress</span>
      </div>
    </div>
  );
}

function PortableStudyShell({
  children,
  onNavigate,
  authenticated,
  name,
}: {
  children: React.ReactNode;
  onNavigate: (screen: Screen) => void;
  authenticated: boolean;
  name?: string | null;
}) {
  return (
    <div className="legacy-study study-hero min-h-screen overflow-hidden bg-[#06353a] text-white">
      <video
        className="absolute inset-0 size-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src={portablePageVideoUrl} type="video/mp4" />
      </video>
      <div
        className="study-video-overlay absolute inset-0 z-0"
        style={{ backgroundColor: "rgba(5, 47, 53, 0.82)" }}
      />
      <header className="relative z-20 mx-auto flex h-[78px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <button
          onClick={() => onNavigate("dashboard")}
          className="font-display text-[27px] tracking-[-0.05em] text-white"
        >
          MockE
          <sup className="ml-0.5 align-super font-sans text-[9px] tracking-normal">
            ®
          </sup>
        </button>
        <div className="hidden items-center gap-5 md:flex">
          <button
            onClick={() => onNavigate("student")}
            className="text-sm text-white/65 hover:text-white"
          >
            Study desk
          </button>
          <button
            onClick={() => onNavigate("exams")}
            className="text-sm text-white/65 hover:text-white"
          >
            Exam library
          </button>
          <button
            onClick={() => onNavigate("purchases")}
            className="text-sm text-white/65 hover:text-white"
          >
            My access
          </button>
          <button
            onClick={() => onNavigate("pricing")}
            className="text-sm text-white/65 hover:text-white"
          >
            Monthly plans
          </button>
        </div>
        <div className="flex items-center gap-2">
          <AccessibilityControls />
          {authenticated ? (
            <button
              onClick={() => onNavigate("profile")}
              className="liquid-glass rounded-full px-4 py-2 text-sm font-medium text-white"
            >
              {name || "Profile"}
            </button>
          ) : (
            <>
              <button
                onClick={() => onNavigate("login")}
                className="rounded-full px-3 py-2 text-sm font-medium text-white/80 hover:text-white"
              >
                Sign in
              </button>
              <button
                onClick={() => onNavigate("login")}
                className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#003447]"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-5 sm:px-8">
        {children}
      </main>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const displayAccount = displayAccountState(
    readQaAccountOverride(window.location.search, import.meta.env.DEV),
    isAuthenticated,
    Boolean(user?.isOwner)
  );
  const { reducedMotion } = useTheme();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [reviewed, setReviewed] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(10142);
  const [selectedExam, setSelectedExam] = useState("JEE Main");
  const [selectedMocks, setSelectedMocks] = useState(4);
  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(
    () => Number(window.localStorage.getItem("mocke-active-attempt")) || null
  );
  const legacyVideoRef = useRef<HTMLVideoElement>(null);
  const createAttempt = trpc.attempts.create.useMutation();
  const saveProgress = trpc.attempts.saveProgress.useMutation();
  const submitAttempt = trpc.attempts.submit.useMutation();
  const resumeAttempt = trpc.attempts.resume.useQuery(
    { attemptId: activeAttemptId || -1 },
    { enabled: false, retry: false }
  );
  const analyticsSummary = trpc.analytics.summary.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (screen !== "test") return;
    const interval = window.setInterval(
      () => setSecondsLeft(value => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    const video = legacyVideoRef.current;
    if (!video) return;
    if (reducedMotion) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [reducedMotion, screen]);

  const result = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    questions.forEach(question => {
      if (answers[question.id] === undefined) return;
      if (answers[question.id] === question.answer) correct += 1;
      else incorrect += 1;
    });
    return {
      correct,
      incorrect,
      skipped: questions.length - correct - incorrect,
      score: correct * 4 - incorrect,
    };
  }, [answers]);

  const navigate = (next: Screen) => {
    setScreen(next);
    window.history.replaceState(
      null,
      "",
      next === "dashboard" ? window.location.pathname : `#${next}`
    );
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (loading) return;
    if (screen === "operations" && !displayAccount.isOwner) {
      navigate(
        ownerOnlyRouteRedirect(
          displayAccount.authenticated,
          displayAccount.isOwner
        )!
      );
      return;
    }
    const redirect = protectedRouteRedirect(
      screen as
        | "dashboard"
        | "login"
        | "student"
        | "exams"
        | "pricing"
        | "purchases"
        | "profile"
        | "admin",
      displayAccount.authenticated,
      displayAccount.isOwner
    );
    if (redirect) navigate(redirect);
  }, [screen, displayAccount.authenticated, displayAccount.isOwner, loading]);

  const startTest = () => {
    navigate("instructions");
  };

  const chooseMockPack = (exam: string, mocks: number) => {
    setSelectedExam(exam);
    setSelectedMocks(mocks === 4 ? 4 : 10);
    navigate("pricing");
  };

  const beginAttempt = () => {
    if (isAuthenticated) {
      createAttempt.mutate(
        { testId: 1, durationSeconds: 10_800 },
        {
          onSuccess: attempt => {
            setActiveAttemptId(attempt.attemptId);
            window.localStorage.setItem(
              "mocke-active-attempt",
              String(attempt.attemptId)
            );
            setQuestionIndex(0);
            setAnswers({});
            setReviewed([]);
            setSecondsLeft(10_800);
            navigate("test");
          },
          onError: () =>
            toast.error(
              "The secure attempt could not be created. Please retry."
            ),
        }
      );
      return;
    }
    setQuestionIndex(0);
    setAnswers({});
    setReviewed([]);
    setSecondsLeft(10142);
    navigate("test");
  };

  const persistProgress = (
    questionId: number,
    selectedOption: number | undefined,
    markedForReview: boolean
  ) => {
    if (!activeAttemptId || !isAuthenticated) return;
    const question = questions.find(item => item.id === questionId);
    if (!question) return;
    saveProgress.mutate(
      {
        attemptId: activeAttemptId,
        testQuestionId: questionId,
        selectedOption:
          selectedOption === undefined
            ? null
            : String.fromCharCode(65 + selectedOption),
        markedForReview,
        elapsedSeconds: Math.max(0, 10_800 - secondsLeft),
        currentQuestionPosition: questionIndex + 1,
        questionSnapshot: {
          stem: question.text,
          options: question.options,
          subject: question.subject,
          topic: question.topic,
        },
      },
      {
        onError: () =>
          toast.error(
            "Your answer is kept locally, but the secure save needs a retry."
          ),
      }
    );
  };

  const submitTest = () => {
    if (isAuthenticated && activeAttemptId) {
      submitAttempt.mutate(
        { attemptId: activeAttemptId },
        {
          onSuccess: () => {
            window.localStorage.removeItem("mocke-active-attempt");
            setActiveAttemptId(null);
            toast.success("Attempt submitted", {
              description: "The server evaluated your saved response record.",
            });
            navigate("results");
          },
          onError: () =>
            toast.error(
              "The server could not submit this attempt. Please retry."
            ),
        }
      );
      return;
    }
    toast.success("Attempt submitted", {
      description: "Your saved answers have been evaluated in this preview.",
    });
    navigate("results");
  };

  const recoverAttempt = async () => {
    if (!activeAttemptId || !isAuthenticated) return startTest();
    const response = await resumeAttempt.refetch();
    if (!response.data) {
      toast.error("The saved attempt is unavailable.");
      return;
    }
    const restoredAnswers: Record<number, number> = {};
    const restoredReviews: number[] = [];
    response.data.answers.forEach(answer => {
      if (answer.selectedOption)
        restoredAnswers[answer.testQuestionId] =
          answer.selectedOption.charCodeAt(0) - 65;
      if (answer.markedForReview) restoredReviews.push(answer.testQuestionId);
    });
    setAnswers(restoredAnswers);
    setReviewed(restoredReviews);
    setQuestionIndex(
      Math.max(0, response.data.attempt.currentQuestionPosition - 1)
    );
    setSecondsLeft(
      response.data.attempt.expiresAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(response.data.attempt.expiresAt).getTime() -
                Date.now()) /
                1000
            )
          )
        : 10_800
    );
    toast.success("Attempt recovered", {
      description: "Saved answers and review marks have been restored.",
    });
    navigate("test");
  };

  const nav = [
    { id: "dashboard" as const, label: "Overview", icon: Layers3 },
    { id: "operations" as const, label: "Content studio", icon: BookOpenCheck },
    { id: "plans" as const, label: "Plans & access", icon: Sparkles },
  ];

  const sidebar = (
    <>
      <div className="px-5 pt-6">
        <Brand />
      </div>
      <div className="mx-5 mt-8 rounded-2xl bg-[#eef4ff] p-3.5">
        <div className="flex items-center gap-2 text-[#244d9e]">
          <Sparkles className="size-4" />
          <span className="text-xs font-semibold">JEE Main 2026</span>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#61739c]">
          Your learning path is active.
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#d7e5ff]">
          <div className="h-full w-[68%] rounded-full bg-[#3e70d4]" />
        </div>
      </div>
      <nav className="mt-7 px-3" aria-label="Primary navigation">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#99a4b7]">
          Workspace
        </p>
        <div className="space-y-1">
          {nav.map(item => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`nav-item w-full ${active ? "nav-item-active" : ""}`}
              >
                <item.icon className="size-[18px]" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button onClick={startTest} className="nav-item w-full">
            <TimerReset className="size-[18px]" />
            <span>Mock tests</span>
            <span className="ml-auto rounded-md bg-[#edf2f8] px-1.5 py-0.5 text-[10px] text-[#8290a6]">
              3
            </span>
          </button>
          <button
            onClick={() =>
              toast.info("Analytics will expand as attempts are recorded.")
            }
            className="nav-item w-full"
          >
            <Command className="size-[18px]" />
            <span>Performance</span>
          </button>
        </div>
      </nav>
      <div className="mt-auto px-5 pb-5">
        <div className="rounded-2xl border border-[#e7ebf1] bg-white p-3.5 shadow-[0_8px_30px_rgba(31,54,95,0.04)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#2a875f]" />
            <span className="text-xs font-semibold text-[#354565]">
              Secure by design
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-[#758198]">
            Timed sessions, saved state, and verified access controls.
          </p>
        </div>
      </div>
    </>
  );

  if (screen === "dashboard")
    return (
      <MainStudyLanding
        onNavigate={navigate}
        authenticated={displayAccount.authenticated}
      />
    );
  if (screen === "login")
    return (
      <AuthPanel
        onNavigate={navigate}
        onSignIn={() => navigate("profile")}
        onSignUp={() => navigate("student")}
        authenticated={displayAccount.authenticated}
      />
    );
  if (screen === "student")
    return (
      <StudentDashboard
        onNavigate={navigate}
        onStartMock={startTest}
        authenticated={isAuthenticated}
        name={user?.name || "Tanishq"}
      />
    );
  if (screen === "exams")
    return (
      <MonthlyExamLibrary
        onNavigate={navigate}
        onChoosePlan={chooseMockPack}
        authenticated={isAuthenticated}
        name={user?.name || "Tanishq"}
      />
    );
  if (screen === "pricing")
    return (
      <MonthlyPricing
        onNavigate={navigate}
        selectedExam={selectedExam}
        selectedPlan={selectedMocks}
        onSelectPlan={setSelectedMocks}
        onCheckout={() =>
          toast.info(
            "Monthly checkout is ready to activate once production payment variables are configured."
          )
        }
        authenticated={isAuthenticated}
        name={user?.name || "Tanishq"}
      />
    );
  if (screen === "purchases")
    return (
      <MonthlyPurchases
        onNavigate={navigate}
        authenticated={isAuthenticated}
        name={user?.name || "Tanishq"}
      />
    );
  if (screen === "profile")
    return displayAccount.authenticated ? (
      <Profile
        onNavigate={navigate}
        onLogout={async () => {
          const destination = await completeLogout(logout);
          toast.success("You have been logged out.");
          navigate(destination);
        }}
        authenticated={displayAccount.authenticated}
        name={user?.name}
        email={user?.email}
        role={user?.role}
        isOwner={displayAccount.isOwner}
      />
    ) : null;
  if (screen === "admin")
    return displayAccount.isOwner ? (
      <OwnerConsole onNavigate={navigate} name={user?.name || "Tanishq"} />
    ) : null;
  if (["instructions", "test", "results", "operations"].includes(screen))
    return (
      <PortableStudyShell
        onNavigate={navigate}
        authenticated={displayAccount.authenticated}
        name={user?.name}
      >
        {screen === "instructions" && (
          <TestInstructions
            onBegin={beginAttempt}
            onBack={() => navigate("dashboard")}
          />
        )}
        {screen === "test" && (
          <TestView
            questionIndex={questionIndex}
            setQuestionIndex={setQuestionIndex}
            answers={answers}
            setAnswers={setAnswers}
            reviewed={reviewed}
            setReviewed={setReviewed}
            secondsLeft={secondsLeft}
            onPersist={persistProgress}
            onSubmit={submitTest}
          />
        )}
        {screen === "results" && (
          <Results
            score={result}
            onReview={() => navigate("test")}
            onHome={() => navigate("dashboard")}
          />
        )}
        {screen === "operations" && <Operations />}
      </PortableStudyShell>
    );
  if (screen === "plans")
    return (
      <MonthlyPricing
        onNavigate={navigate}
        selectedExam={selectedExam}
        selectedPlan={selectedMocks}
        onSelectPlan={setSelectedMocks}
        onCheckout={() =>
          toast.info(
            "Monthly checkout is ready to activate once production payment variables are configured."
          )
        }
        authenticated={isAuthenticated}
        name={user?.name || "Tanishq"}
      />
    );
  return (
    <PortableStudyShell
      onNavigate={navigate}
      authenticated={displayAccount.authenticated}
      name={user?.name}
    >
      <p className="rounded-2xl border border-white/15 bg-[#003447]/60 p-6 text-sm text-white/75">
        This study screen is unavailable. Return to the study dashboard to
        continue.
      </p>
    </PortableStudyShell>
  );
}

function Dashboard({
  onStart,
  onResume,
  hasRecovery,
  liveAnalytics,
  onNavigate,
}: {
  onStart: () => void;
  onResume: () => void;
  hasRecovery: boolean;
  liveAnalytics?: {
    totals: {
      tests: number;
      averageScore: number;
      accuracy: number;
      totalQuestions: number;
      totalTimeSeconds: number;
    };
    history: Array<{ score: number }>;
  };
  onNavigate: (screen: Screen) => void;
}) {
  const totals = liveAnalytics?.totals;
  const history = liveAnalytics?.history ?? [];
  return (
    <div className="mx-auto max-w-[1420px] px-5 py-7 sm:px-8 lg:px-9 lg:py-9">
      <section className="relative overflow-hidden rounded-[28px] bg-[#152d68] px-6 py-7 text-white shadow-[0_16px_40px_rgba(21,45,104,0.18)] sm:px-9 sm:py-9">
        <div className="absolute -right-24 -top-20 size-72 rounded-full border border-white/10" />
        <div className="absolute right-20 top-16 size-48 rounded-full border border-white/10" />
        <div className="absolute bottom-0 right-0 h-32 w-[45%] bg-[linear-gradient(135deg,transparent_0%,rgba(93,154,255,0.13)_100%)]" />
        <div className="relative max-w-xl">
          <SmallPill tone="blue">
            <span className="text-[#3260ad]">NEXT RECOMMENDED SESSION</span>
          </SmallPill>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.045em] sm:text-[32px]">
            Build momentum with a full-length mock.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[#bdcbe9]">
            Your recent pace suggests a full mock will give the clearest signal
            on accuracy, pacing, and high-impact topics.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#19336f] transition active:scale-[0.97]"
            >
              Start mock <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => onNavigate("plans")}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.97]"
            >
              View access
            </button>
          </div>
        </div>
        <div className="relative mt-8 grid max-w-xl grid-cols-3 gap-3 border-t border-white/10 pt-5">
          <HeroMetric
            value={totals?.tests ? `${totals.accuracy}%` : "68%"}
            label="Current accuracy"
          />
          <HeroMetric
            value={totals?.tests ? String(totals.tests) : "7"}
            label="Mocks completed"
          />
          <HeroMetric
            value={
              history.length > 1
                ? `${history.at(-1)!.score - history[0].score >= 0 ? "+" : ""}${history.at(-1)!.score - history[0].score}`
                : "+12"
            }
            label="Score trend"
          />
        </div>
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="eyebrow">CONTINUE LEARNING</p>
              <h2 className="section-heading">Your next sessions</h2>
            </div>
            <button
              className="link-button"
              onClick={() => toast.info("All scheduled tests are up to date.")}
            >
              View all <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TestCard
              label="FULL MOCK"
              title="JEE Main · Full Mock 07"
              meta="3 hrs · 60 questions · −1 marking"
              progress="Ready to begin"
              color="blue"
              action={onStart}
            />
            <TestCard
              label="TOPIC SPRINT"
              title="Differential Calculus"
              meta="45 mins · 20 questions · Free"
              progress={
                hasRecovery ? "Resume saved attempt" : "Resume available"
              }
              color="gold"
              action={hasRecovery ? onResume : onStart}
            />
          </div>
        </div>
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">PERFORMANCE</p>
              <h2 className="section-heading">Score trajectory</h2>
            </div>
            <button
              onClick={() =>
                toast.info(
                  "Detailed historical charts are available after your first submitted attempt."
                )
              }
              className="grid size-8 place-items-center rounded-lg bg-[#f4f6fb] text-[#64728b]"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          <div className="mt-4 flex h-[128px] items-end gap-3 px-1">
            {(history.length
              ? history.slice(-5)
              : [
                  { score: 43 },
                  { score: 54 },
                  { score: 46 },
                  { score: 68 },
                  { score: 61 },
                ]
            ).map((point, index, all) => (
              <Bar
                key={index}
                h={`${Math.max(18, Math.min(100, Math.abs(point.score)))}%`}
                label={`M${index + 1}`}
                active={index === all.length - 1}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5f8fd] p-3">
            <div>
              <p className="text-xs font-semibold text-[#354565]">
                {totals?.tests
                  ? "Saved performance history"
                  : "Your best category"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8290a7]">
                {totals?.tests
                  ? `${totals.totalQuestions} questions · ${totals.totalTimeSeconds}s tracked`
                  : "Mathematics · 74% accuracy"}
              </p>
            </div>
            <SmallPill tone="green">
              {totals?.tests ? "Live" : "Improving"}
            </SmallPill>
          </div>
        </div>
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <p className="eyebrow">FOCUS MAP</p>
              <h2 className="section-heading">Know what to work on</h2>
            </div>
            <button
              className="link-button"
              onClick={() =>
                toast.info(
                  "Topic recommendations will update from scored attempts."
                )
              }
            >
              See insights <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div className="mt-5 divide-y divide-[#edf0f5]">
            <FocusRow
              label="Electrostatics"
              kind="Revisit"
              tone="red"
              stat="42% accuracy"
              width="42%"
            />
            <FocusRow
              label="Organic chemistry"
              kind="Stabilizing"
              tone="gold"
              stat="61% accuracy"
              width="61%"
            />
            <FocusRow
              label="Coordinate geometry"
              kind="Strength"
              tone="green"
              stat="78% accuracy"
              width="78%"
            />
          </div>
        </div>
        <div className="panel p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#eef6f2] text-[#268159]">
              <TimerReset className="size-5" />
            </div>
            <div>
              <p className="eyebrow">SMART PACING</p>
              <h2 className="section-heading">Time benchmark</h2>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <MetricBox label="Your avg." value="1m 48s" detail="per question" />
            <MetricBox label="Target" value="1m 30s" detail="for JEE Main" />
          </div>
          <p className="mt-5 text-xs leading-5 text-[#738099]">
            Time spent is always measured from the secured attempt timeline, not
            from a browser-supplied score.
          </p>
        </div>
      </section>
    </div>
  );
}

function TestInstructions({
  onBegin,
  onBack,
}: {
  onBegin: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-[940px] px-5 py-8 sm:px-8 lg:py-12">
      <div className="panel overflow-hidden">
        <div className="bg-[#173573] px-6 py-7 text-white sm:px-8">
          <SmallPill tone="blue">
            <span className="text-[#3260ad]">BEFORE YOU BEGIN</span>
          </SmallPill>
          <h2 className="mt-4 font-display text-[29px] font-semibold tracking-[-0.045em]">
            JEE Main · Full Mock 07
          </h2>
          <p className="mt-2 text-sm text-[#bdcbe9]">
            Read the test conditions once. The exam clock starts only when you
            begin.
          </p>
        </div>
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-2">
          <div>
            <p className="eyebrow">TEST FORMAT</p>
            <div className="mt-4 space-y-3">
              <InstructionRow
                icon={Clock3}
                title="3 hours"
                detail="The secured attempt deadline is calculated from the server start time."
              />
              <InstructionRow
                icon={BookOpenCheck}
                title="60 questions"
                detail="Each question has +4 marks for a correct answer and −1 for an incorrect answer."
              />
              <InstructionRow
                icon={Flag}
                title="Review controls"
                detail="Use Mark for review when you want to return to a question before submitting."
              />
            </div>
          </div>
          <div>
            <p className="eyebrow">SESSION RELIABILITY</p>
            <div className="mt-4 space-y-3">
              <InstructionRow
                icon={ShieldCheck}
                title="Answers are saved"
                detail="Each saved response belongs to the attempt record and can be reopened while it remains active."
              />
              <InstructionRow
                icon={TimerReset}
                title="Keep an eye on time"
                detail="The timer keeps running even if you navigate away from a question."
              />
              <InstructionRow
                icon={LockKeyhole}
                title="Submit once"
                detail="Final submission is designed to be idempotent and evaluated with the marking snapshot."
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e7ebf0] bg-[#fbfcfe] px-6 py-5 sm:px-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#708098]"
          >
            <ChevronLeft className="size-4" />
            Back to dashboard
          </button>
          <button
            onClick={onBegin}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1b3472] px-5 py-3 text-sm font-semibold text-white shadow-[0_7px_16px_rgba(29,55,119,0.22)] transition active:scale-[0.97]"
          >
            Begin attempt <Play className="size-4" fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}

function InstructionRow({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Clock3;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#e7ebf1] bg-[#fcfdff] p-3.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[#4268ae]">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs font-semibold text-[#435576]">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-[#7b899f]">{detail}</p>
      </div>
    </div>
  );
}

function TestView({
  questionIndex,
  setQuestionIndex,
  answers,
  setAnswers,
  reviewed,
  setReviewed,
  secondsLeft,
  onPersist,
  onSubmit,
}: {
  questionIndex: number;
  setQuestionIndex: (i: number) => void;
  answers: Record<number, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  reviewed: number[];
  setReviewed: React.Dispatch<React.SetStateAction<number[]>>;
  secondsLeft: number;
  onPersist: (
    questionId: number,
    selectedOption: number | undefined,
    markedForReview: boolean
  ) => void;
  onSubmit: () => void;
}) {
  const question = questions[questionIndex];
  const selected = answers[question.id];
  const marked = reviewed.includes(question.id);
  const selectAnswer = (option: number) => {
    setAnswers(current => ({ ...current, [question.id]: option }));
    onPersist(question.id, option, marked);
    toast.success("Answer saved", {
      description: "Your response has been recorded.",
    });
  };
  const toggleReview = () => {
    const nextMarked = !marked;
    setReviewed(current =>
      nextMarked
        ? [...current, question.id]
        : current.filter(id => id !== question.id)
    );
    onPersist(question.id, selected, nextMarked);
  };
  return (
    <div className="legacy-test min-h-[calc(100vh-70px)] bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1370px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0e7f0] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(31,54,95,0.04)] sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf1ff] text-[#2d5db4]">
              <BookOpenCheck className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#26385d]">
                JEE Main · Full Mock 07
              </p>
              <p className="text-[11px] text-[#7f8ca2]">Section A · Physics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#fff6e9] px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a7701d]">
                Time left
              </p>
              <p className="font-mono text-sm font-bold text-[#8f5c10]">
                {formatTime(secondsLeft)}
              </p>
            </div>
            <button
              onClick={onSubmit}
              className="rounded-xl bg-[#1b3472] px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_5px_12px_rgba(31,59,129,0.22)] transition active:scale-[0.97]"
            >
              Submit test
            </button>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <section className="panel overflow-hidden">
            <div className="border-b border-[#e9edf3] px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SmallPill tone="blue">
                    QUESTION {questionIndex + 1} OF 60
                  </SmallPill>
                  <span className="text-[11px] font-medium text-[#7c8aa2]">
                    +4 / −1
                  </span>
                </div>
                <button
                  onClick={toggleReview}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${marked ? "border-[#edc36d] bg-[#fff8e6] text-[#996307]" : "border-[#dfe6ef] text-[#66758d] hover:bg-[#f7f9fc]"}`}
                >
                  <Flag
                    className="size-3.5"
                    fill={marked ? "currentColor" : "none"}
                  />
                  {marked ? "Marked for review" : "Mark for review"}
                </button>
              </div>
            </div>
            <div className="px-5 py-7 sm:px-7 sm:py-9">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid size-8 place-items-center rounded-lg bg-[#f0f4fa] text-xs font-bold text-[#64738c]">
                  {questionIndex + 1}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#405276]">
                    {question.subject}
                  </p>
                  <p className="text-[11px] text-[#8390a5]">{question.topic}</p>
                </div>
              </div>
              <h2 className="max-w-3xl font-display text-xl font-medium leading-8 tracking-[-0.025em] text-[#21355c] sm:text-[22px]">
                {question.text}
              </h2>
              <div className="mt-8 grid gap-3">
                {question.options.map((option, index) => (
                  <button
                    key={option}
                    onClick={() => selectAnswer(index)}
                    className={`group flex items-center gap-3 rounded-xl border p-4 text-left transition ${selected === index ? "border-[#5f8ded] bg-[#f1f6ff] shadow-[0_3px_10px_rgba(74,122,211,0.08)]" : "border-[#e1e7ef] bg-white hover:border-[#b9cbe8] hover:bg-[#fbfdff]"}`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${selected === index ? "border-[#4979d8] bg-[#4979d8] text-white" : "border-[#d7dfe9] text-[#6c7a90] group-hover:border-[#9fb7df]"}`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-sm font-medium leading-6 text-[#405274]">
                      {option}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#e9edf3] bg-[#fbfcfe] px-5 py-4 sm:px-7">
              <button
                onClick={() => setQuestionIndex(Math.max(0, questionIndex - 1))}
                disabled={questionIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[#65748b] disabled:opacity-35"
              >
                <ChevronLeft className="size-4" /> Previous
              </button>
              <button
                onClick={() =>
                  setQuestionIndex(
                    Math.min(questions.length - 1, questionIndex + 1)
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaf1ff] px-3 py-2 text-xs font-semibold text-[#315aaf]"
              >
                Save & next <ChevronRight className="size-4" />
              </button>
            </div>
          </section>
          <aside className="panel h-fit p-5 xl:sticky xl:top-[94px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">QUESTION PALETTE</p>
                <h2 className="section-heading">Navigate</h2>
              </div>
              <CircleHelp className="size-4 text-[#8b97aa]" />
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {numberTiles.map(number => {
                const local = questions[number - 1];
                const isAnswered = local && answers[local.id] !== undefined;
                const isMarked = local && reviewed.includes(local.id);
                return (
                  <button
                    key={number}
                    onClick={() =>
                      local
                        ? setQuestionIndex(number - 1)
                        : toast.info(
                            "This preview includes four sample questions."
                          )
                    }
                    className={`grid aspect-square place-items-center rounded-lg text-xs font-bold transition ${number === questionIndex + 1 ? "bg-[#254c9b] text-white shadow-[0_4px_10px_rgba(37,76,155,0.23)]" : isMarked ? "bg-[#fff1c7] text-[#a66c0b]" : isAnswered ? "bg-[#dcf4e8] text-[#1d7a50]" : "bg-[#f1f4f8] text-[#7b889c]"}`}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 space-y-2 border-t border-[#edf0f4] pt-4 text-[11px] text-[#7d899d]">
              <Legend color="bg-[#dcf4e8]" label="Answered" />
              <Legend color="bg-[#fff1c7]" label="Marked for review" />
              <Legend color="bg-[#f1f4f8]" label="Not visited" />
            </div>
            <div className="mt-5 rounded-xl bg-[#f5f8fc] p-3.5">
              <div className="flex items-center gap-2 text-[#57709d]">
                <LockKeyhole className="size-3.5" />
                <span className="text-[11px] font-semibold">
                  Recovery active
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-[#7c8aa1]">
                Saved answers are tied to the attempt session. Reopen on another
                screen to resume.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Results({
  score,
  onReview,
  onHome,
}: {
  score: { correct: number; incorrect: number; skipped: number; score: number };
  onReview: () => void;
  onHome: () => void;
}) {
  const pct = Math.max(0, Math.round((score.score / 16) * 100));
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 lg:px-9 lg:py-9">
      <section className="relative overflow-hidden rounded-[28px] bg-[#15326f] px-6 py-7 text-white shadow-[0_16px_40px_rgba(21,45,104,0.18)] sm:px-9">
        <div className="absolute -right-10 -top-12 size-64 rounded-full border border-white/10" />
        <div className="relative grid items-center gap-7 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SmallPill tone="blue">
              <span className="text-[#3260ad]">ATTEMPT EVALUATED</span>
            </SmallPill>
            <h2 className="mt-4 font-display text-[29px] font-semibold tracking-[-0.045em]">
              You have a clear next move.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#c2cde5]">
              The score is calculated deterministically from the answer snapshot
              and test marking rules.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={onReview}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#19336f] transition active:scale-[0.97]"
              >
                Review answers
              </button>
              <button
                onClick={onHome}
                className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.97]"
              >
                Dashboard
              </button>
            </div>
          </div>
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aebfe5]">
              Final score
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-display text-5xl font-semibold tracking-[-0.06em]">
                {score.score}
              </span>
              <span className="mb-1 text-sm text-[#c4d0eb]">/ 16</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#83b0ff]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#bdcae6]">
              {pct}% of the available marks
            </p>
          </div>
        </div>
      </section>
      <section className="mt-7 grid gap-5 md:grid-cols-4">
        <ResultStat
          value={String(score.correct)}
          label="Correct"
          tone="green"
        />
        <ResultStat
          value={String(score.incorrect)}
          label="Incorrect"
          tone="red"
        />
        <ResultStat
          value={String(score.skipped)}
          label="Skipped"
          tone="slate"
        />
        <ResultStat value="1m 48s" label="Avg. time" tone="blue" />
      </section>
      <section className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5 sm:p-6">
          <p className="eyebrow">SUBJECT BREAKDOWN</p>
          <h2 className="section-heading">Where the marks went</h2>
          <div className="mt-6 space-y-5">
            <Breakdown
              label="Physics"
              score="8 / 12"
              color="bg-[#507ed8]"
              width="67%"
            />
            <Breakdown
              label="Chemistry"
              score="4 / 12"
              color="bg-[#e4a546]"
              width="33%"
            />
            <Breakdown
              label="Mathematics"
              score="6 / 12"
              color="bg-[#3b9a75]"
              width="50%"
            />
          </div>
          <div className="mt-7 rounded-xl border border-[#e5eaf1] bg-[#f8fafc] p-4">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#497ad7]" />
              <p className="text-xs leading-5 text-[#63728a]">
                <strong className="font-semibold text-[#3e5072]">
                  Actionable focus:
                </strong>{" "}
                Start with speed drills in Atomic Structure, then re-attempt a
                mixed Physics set to reinforce your stronger base.
              </p>
            </div>
          </div>
        </div>
        <div className="panel p-5 sm:p-6">
          <p className="eyebrow">QUESTION-WISE ANALYSIS</p>
          <h2 className="section-heading">Every decision, visible</h2>
          <div className="mt-5 space-y-2.5">
            <QuestionInsight
              label="Q1 · Kinematics"
              detail="Correct · 0m 40s"
              tone="green"
            />
            <QuestionInsight
              label="Q2 · Atomic Structure"
              detail="Incorrect · 0m 58s"
              tone="red"
            />
            <QuestionInsight
              label="Q3 · Calculus"
              detail="Skipped · 0m 00s"
              tone="slate"
            />
            <QuestionInsight
              label="Q4 · Current Electricity"
              detail="Review suggestion · 1m 18s"
              tone="blue"
            />
          </div>
          <div className="mt-6 rounded-2xl bg-[#f7f9fc] p-4">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-[#6382bb]" />
              <p className="text-xs font-semibold text-[#415476]">
                Pacing insight
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#728098]">
              When you meet a difficult calculus question, decide within 40
              seconds whether to mark it for review. That protects time for
              high-confidence questions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Operations() {
  const [query, setQuery] = useState("");
  const { user, isAuthenticated } = useAuth();
  const canReview = Boolean(
    isAuthenticated &&
      user &&
      ["reviewer", "admin", "super_admin"].includes(user.role)
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueSummary = trpc.reviewer.queueSummary.useQuery(undefined, {
    enabled: canReview,
  });
  const reviewQueue = trpc.reviewer.queueList.useQuery(
    { search: query || undefined },
    { enabled: canReview }
  );
  const uploadPdf = trpc.documents.ingestPdf.useMutation();
  const reviewQuestion = trpc.questionBank.review.useMutation();
  const liveRows =
    reviewQueue.data?.map(item => ({
      title: item.stem.length > 72 ? `${item.stem.slice(0, 72)}…` : item.stem,
      source: `Question ${item.id} · version ${item.currentVersion}`,
      signals: `${item.qualityScore}/100 quality · ${item.difficulty}`,
      status: "Needs review",
      tone: "amber" as const,
    })) ?? [];
  const previewRows = [
    {
      title: "Electrostatic potential at a point",
      source: "JEE Main 2024 · p. 8",
      signals: "0.91 confidence · 0.08 similarity",
      status: "Needs review",
      tone: "amber" as const,
    },
    {
      title: "Aromatic substitution mechanism",
      source: "Organic chemistry set · p. 14",
      signals: "0.96 confidence · no duplicate",
      status: "Validated",
      tone: "green" as const,
    },
    {
      title: "Definite integral bounds",
      source: "Mock paper source · p. 22",
      signals: "0.83 confidence · 0.22 similarity",
      status: "Needs review",
      tone: "amber" as const,
    },
  ];
  const queueRows = canReview ? liveRows : previewRows;
  const ingestFile = (file: File | undefined) => {
    if (!file) return;
    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Select a PDF document to begin secure ingestion.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      uploadPdf.mutate(
        { fileName: file.name, base64: String(reader.result), examId: 1 },
        {
          onSuccess: result => {
            toast.success("PDF queued", {
              description: `${result.jobsCreated} protected processing stages were created.`,
            });
            queueSummary.refetch();
          },
          onError: error =>
            toast.error(
              error.message || "The PDF could not enter the processing queue."
            ),
        }
      );
    reader.onerror = () =>
      toast.error("The selected PDF could not be read locally.");
    reader.readAsDataURL(file);
  };
  return (
    <div className="legacy-operations mx-auto max-w-[1420px] px-5 py-7 sm:px-8 lg:px-9 lg:py-9">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={event => ingestFile(event.target.files?.[0])}
      />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">ADMIN & REVIEWER WORKSPACE</p>
          <h2 className="font-display text-[28px] font-semibold tracking-[-0.045em] text-[#23375c]">
            Content studio
          </h2>
          <p className="mt-1 text-sm text-[#7b889d]">
            A controlled route from source document to reviewed question.
          </p>
        </div>
        <button
          onClick={() =>
            canReview
              ? fileInputRef.current?.click()
              : toast.info(
                  "Sign in with a reviewer or administrator role to upload source PDFs."
                )
          }
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#06353a] shadow-[0_7px_15px_rgba(0,27,31,0.2)] transition active:scale-[0.97]"
        >
          <UploadCloud className="size-4" />
          Upload source PDF
        </button>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OpMetric
          icon={FileUp}
          value={canReview ? String(queueSummary.data?.queued ?? "—") : "28"}
          label="Queued documents"
          tone="blue"
        />
        <OpMetric
          icon={Sparkles}
          value={
            canReview ? String(queueSummary.data?.needsReview ?? "—") : "17"
          }
          label="Awaiting review"
          tone="gold"
        />
        <OpMetric
          icon={Check}
          value="48216"
          label="Published questions"
          tone="green"
        />
        <OpMetric
          icon={ShieldCheck}
          value="99.7%"
          label="Validation pass rate"
          tone="purple"
        />
      </section>
      <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
            <div>
              <p className="eyebrow">QUESTION GOVERNANCE</p>
              <h2 className="section-heading">
                {canReview ? "Live review queue" : "Preview review queue"}
              </h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/55" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search topic or source"
                className="h-9 w-[210px] rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/45"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-y border-white/15 bg-white/[0.04] text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
                  <th className="px-5 py-3">Question</th>
                  <th className="px-4 py-3">Signals</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {queueRows
                  .filter(
                    item =>
                      item.title.toLowerCase().includes(query.toLowerCase()) ||
                      item.source.toLowerCase().includes(query.toLowerCase())
                  )
                  .map(item => (
                    <tr
                      key={item.title}
                      className="border-b border-white/10 text-xs"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-[11px] text-white/55">
                          {item.source}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[11px] text-white/65">
                        {item.signals}
                      </td>
                      <td className="px-4 py-4">
                        <SmallPill tone={item.tone}>{item.status}</SmallPill>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() =>
                            canReview && "id" in item
                              ? reviewQuestion.mutate(
                                  {
                                    questionId: item.id as number,
                                    decision: "approved",
                                    note: "Approved from reviewer workspace.",
                                  },
                                  {
                                    onSuccess: () => {
                                      toast.success("Question approved");
                                      reviewQueue.refetch();
                                      queueSummary.refetch();
                                    },
                                    onError: error =>
                                      toast.error(error.message),
                                  }
                                )
                              : toast.info(
                                  "Reviewer records require a reviewer or administrator role."
                                )
                          }
                          className="rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                        >
                          Approve
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {canReview && !reviewQueue.isLoading && queueRows.length === 0 && (
              <p className="px-5 py-6 text-xs text-white/55">
                No questions currently require review.
              </p>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="panel p-5">
            <p className="eyebrow">PIPELINE VISIBILITY</p>
            <h2 className="section-heading">Processing flow</h2>
            <div className="mt-5 space-y-0">
              <PipelineStep
                icon={UploadCloud}
                title="Secured upload"
                detail="Object key + SHA-256 recorded"
                state="Complete"
              />
              <PipelineStep
                icon={Search}
                title="Extract & classify"
                detail="OCR and question structure detection"
                state="Processing"
                active
              />
              <PipelineStep
                icon={Sparkles}
                title="AI validation"
                detail="Schema checks, confidence, duplicate signal"
                state="Queued"
              />
              <PipelineStep
                icon={Check}
                title="Human review"
                detail="Version approval before publication"
                state="Protected"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-white/75" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Controls that stay server-side
                </p>
                <p className="mt-1.5 text-xs leading-5 text-white/65">
                  Role checks, quality decisions, publication status, payment
                  verification, and scoring are designed to be evaluated in
                  protected procedures rather than trusted to the browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Plans() {
  return (
    <div className="legacy-plans mx-auto max-w-[1180px] px-5 py-7 sm:px-8 lg:px-9 lg:py-9">
      <div className="mx-auto max-w-xl text-center">
        <SmallPill tone="blue">JEE MAIN ACCESS</SmallPill>
        <h2 className="mt-4 font-display text-[31px] font-semibold tracking-[-0.05em] text-white">
          Learn with a plan that fits your pace.
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Access is scoped to an exam and activated only after server-side
          payment verification.
        </p>
      </div>
      <div className="mt-9 grid gap-5 md:grid-cols-3">
        <PlanCard
          name="Monthly"
          price="₹349"
          suffix="/ month"
          detail="For a focused sprint"
          points={[
            "All JEE Main mocks",
            "Topic practice",
            "Detailed attempt review",
          ]}
        />
        <PlanCard
          name="Quarterly"
          price="₹899"
          suffix="/ 3 months"
          detail="Best value for preparation"
          points={[
            "Everything in Monthly",
            "Priority content releases",
            "Historical performance views",
          ]}
          featured
        />
        <PlanCard
          name="Yearly"
          price="₹2,999"
          suffix="/ year"
          detail="For long-range preparation"
          points={[
            "Everything in Quarterly",
            "Full test archive",
            "Exam-cycle continuity",
          ]}
        />
      </div>
      <section className="mt-8 rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-[0_10px_28px_rgba(0,27,31,0.2)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Payment verification boundary
            </p>
            <p className="mt-1 text-xs leading-5 text-white/65">
              A purchase flow must create an order on the server, verify signed
              webhook data, run an idempotency check, and then activate the exam
              subscription. The preview intentionally does not simulate a
              completed payment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold tracking-[-0.04em]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#b9c8e7]">{label}</p>
    </div>
  );
}
function TestCard({
  label,
  title,
  meta,
  progress,
  color,
  action,
}: {
  label: string;
  title: string;
  meta: string;
  progress: string;
  color: "blue" | "gold";
  action: () => void;
}) {
  return (
    <article className="panel group p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(28,52,98,0.08)]">
      <div className="flex items-start justify-between">
        <SmallPill tone={color === "blue" ? "blue" : "amber"}>
          {label}
        </SmallPill>
        <button
          className="text-[#98a4b8] transition group-hover:text-[#5876ad]"
          onClick={() =>
            toast.info("Test options are available when a session is created.")
          }
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      <h3 className="mt-4 font-display text-[17px] font-semibold tracking-[-0.025em] text-[#35496d]">
        {title}
      </h3>
      <p className="mt-2 text-xs text-[#7c899f]">{meta}</p>
      <div className="mt-5 flex items-center justify-between border-t border-[#edf0f4] pt-4">
        <span className="text-[11px] font-medium text-[#69809d]">
          {progress}
        </span>
        <button
          onClick={action}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d5db1]"
        >
          {progress === "Resume available" ? "Resume" : "Start"}
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </article>
  );
}
function Bar({
  h,
  label,
  active = false,
}: {
  h: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-2">
      <div
        className={`w-full max-w-8 rounded-t-md ${active ? "bg-[#3e70d4]" : "bg-[#dbe5f5]"}`}
        style={{ height: h }}
      />
      <span
        className={`text-[10px] ${active ? "font-bold text-[#3e70d4]" : "text-[#98a4b8]"}`}
      >
        {label}
      </span>
    </div>
  );
}
function FocusRow({
  label,
  kind,
  tone,
  stat,
  width,
}: {
  label: string;
  kind: string;
  tone: "red" | "gold" | "green";
  stat: string;
  width: string;
}) {
  const colors = {
    red: "bg-[#dc6d65]",
    gold: "bg-[#e3aa48]",
    green: "bg-[#39a176]",
  };
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 px-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#435577]">{label}</p>
          <SmallPill
            tone={
              tone === "red" ? "amber" : tone === "green" ? "green" : "blue"
            }
          >
            {kind}
          </SmallPill>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
          <div
            className={`h-full rounded-full ${colors[tone]}`}
            style={{ width }}
          />
        </div>
      </div>
      <p className="text-[11px] font-medium text-[#7b879b]">{stat}</p>
    </div>
  );
}
function MetricBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7ebf1] bg-[#fbfcfe] p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#96a1b1]">
        {label}
      </p>
      <p className="mt-2 font-display text-[18px] font-semibold tracking-[-0.035em] text-[#3e5277]">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[#8a96a9]">{detail}</p>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2.5 rounded-sm ${color}`} />
      <span>{label}</span>
    </div>
  );
}
function ResultStat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "green" | "red" | "slate" | "blue";
}) {
  const styles = {
    green: "bg-[#ecf9f1] text-[#217852]",
    red: "bg-[#fff0ef] text-[#b85a54]",
    slate: "bg-[#f2f5f8] text-[#60718b]",
    blue: "bg-[#edf4ff] text-[#4266aa]",
  };
  return (
    <div className={`rounded-2xl p-5 ${styles[tone]}`}>
      <p className="font-display text-[25px] font-semibold tracking-[-0.04em]">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}
function Breakdown({
  label,
  score,
  color,
  width,
}: {
  label: string;
  score: string;
  color: string;
  width: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#536583]">{label}</span>
        <span className="text-[#8490a4]">{score}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eff2f6]">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}
function QuestionInsight({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "green" | "red" | "slate" | "blue";
}) {
  const styles = {
    green: "bg-[#e9f8ef] text-[#23815a]",
    red: "bg-[#fff0ef] text-[#bd5d57]",
    slate: "bg-[#f1f4f8] text-[#718099]",
    blue: "bg-[#edf4ff] text-[#4168b0]",
  };
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e8edf3] bg-[#fcfdff] px-3 py-2.5">
      <p className="text-xs font-semibold text-[#536583]">{label}</p>
      <span
        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${styles[tone]}`}
      >
        {detail}
      </span>
    </div>
  );
}
function OpMetric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof FileUp;
  value: string;
  label: string;
  tone: "blue" | "gold" | "green" | "purple";
}) {
  const styles = {
    blue: "bg-[#eaf1ff] text-[#3564b7]",
    gold: "bg-[#fff3d8] text-[#b37a19]",
    green: "bg-[#e9f7ef] text-[#247f58]",
    purple: "bg-[#f1edff] text-[#6f57b9]",
  };
  return (
    <div className="panel flex items-center gap-4 p-4">
      <div
        className={`grid size-10 place-items-center rounded-xl ${styles[tone]}`}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-display text-[21px] font-semibold tracking-[-0.04em] text-[#3c5074]">
          {value}
        </p>
        <p className="text-[11px] text-[#7f8da3]">{label}</p>
      </div>
    </div>
  );
}
function PipelineStep({
  icon: Icon,
  title,
  detail,
  state,
  active = false,
}: {
  icon: typeof UploadCloud;
  title: string;
  detail: string;
  state: string;
  active?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0f4fb] text-[#5071ab]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[#435576]">{title}</p>
          <span
            className={`text-[10px] font-semibold ${active ? "text-[#b27717]" : "text-[#7b8aa1]"}`}
          >
            {state}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-[#8794a8]">{detail}</p>
      </div>
    </div>
  );
}
function PlanCard({
  name,
  price,
  suffix,
  detail,
  points,
  featured = false,
}: {
  name: string;
  price: string;
  suffix: string;
  detail: string;
  points: string[];
  featured?: boolean;
}) {
  return (
    <article
      className={`relative rounded-2xl border p-5 shadow-[0_10px_28px_rgba(31,54,95,0.04)] ${featured ? "border-[#5b86dd] bg-[#f9fbff] shadow-[0_14px_34px_rgba(55,95,180,0.12)]" : "border-[#e2e8f0] bg-white"}`}
    >
      {featured && (
        <span className="absolute right-4 top-4 rounded-full bg-[#eaf1ff] px-2 py-1 text-[10px] font-bold text-[#3861ae]">
          RECOMMENDED
        </span>
      )}
      <p className="text-sm font-semibold text-[#405474]">{name}</p>
      <p className="mt-1 text-xs text-[#8794a8]">{detail}</p>
      <div className="mt-6 flex items-end gap-1">
        <span className="font-display text-3xl font-semibold tracking-[-0.05em] text-[#243b67]">
          {price}
        </span>
        <span className="mb-1 text-xs text-[#8794a8]">{suffix}</span>
      </div>
      <button
        onClick={() =>
          toast.info(
            "Checkout remains disabled until a server-side gateway configuration and webhook secret are supplied."
          )
        }
        className={`mt-6 w-full rounded-xl px-3 py-2.5 text-xs font-semibold transition active:scale-[0.97] ${featured ? "bg-[#1b3575] text-white" : "bg-[#edf3fc] text-[#345ea9]"}`}
      >
        Choose {name}
      </button>
      <ul className="mt-5 space-y-3 border-t border-[#e7ebf1] pt-5">
        {points.map(point => (
          <li
            key={point}
            className="flex gap-2 text-[11px] leading-4 text-[#66758d]"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-[#328563]" />
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}
