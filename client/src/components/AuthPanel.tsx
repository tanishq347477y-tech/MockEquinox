import { LockKeyhole, MailCheck, RotateCcw, ShieldCheck } from "lucide-react";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export type AuthPanelProps = {
  onNavigate: (route: "dashboard" | "login" | "student" | "profile") => void;
  onSignIn: () => void;
  onSignUp: () => void;
  authenticated: boolean;
};

type AuthMode = "signin" | "register" | "forgot" | "reset" | "verify";

function readAuthParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash;
  return new URLSearchParams(
    hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : ""
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
  minLength,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-white/70">
      {label}
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        required={required}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        className="rounded-xl border border-white/20 bg-black/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/60"
      />
    </label>
  );
}

export function AuthPanel({
  onNavigate,
  onSignIn,
  onSignUp,
  authenticated,
}: AuthPanelProps) {
  const params = useMemo(readAuthParams, []);
  const verifyToken = params.get("verify") || "";
  const resetToken = params.get("reset") || "";
  const [mode, setMode] = useState<AuthMode>(() =>
    resetToken ? "reset" : verifyToken ? "verify" : "signin"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [verificationStarted, setVerificationStarted] = useState(false);
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();
  const requestVerification = trpc.auth.requestVerification.useMutation();
  const verifyEmail = trpc.auth.verifyEmail.useMutation();
  const requestPasswordReset = trpc.auth.requestPasswordReset.useMutation();
  const resetPassword = trpc.auth.resetPassword.useMutation();
  const pending =
    login.isPending ||
    register.isPending ||
    requestVerification.isPending ||
    verifyEmail.isPending ||
    requestPasswordReset.isPending ||
    resetPassword.isPending;

  useEffect(() => {
    if (!verifyToken || verificationStarted) return;
    setVerificationStarted(true);
    verifyEmail.mutate(
      { token: verifyToken },
      {
        onSuccess: () => {
          setSuccess("Your email is verified. Your study space is ready.");
          void utils.auth.me.invalidate();
          if (typeof window !== "undefined")
            window.history.replaceState(null, "", "#login");
        },
        onError: error => setMessage(error.message),
      }
    );
  }, [utils.auth.me, verificationStarted, verifyEmail, verifyToken]);

  const clearFeedback = () => {
    setMessage("");
    setSuccess("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    try {
      if (mode === "register") {
        const result = await register.mutateAsync({ name, email, password });
        if (result.verificationRequired) {
          setSuccess(
            "Account created. Check your email for a verification link before signing in."
          );
        } else {
          await utils.auth.me.invalidate();
          onSignUp();
        }
        return;
      }
      if (mode === "forgot") {
        await requestPasswordReset.mutateAsync({ email });
        setSuccess(
          "If an account exists for that email, a reset link is on its way."
        );
        return;
      }
      if (mode === "reset") {
        if (!resetToken)
          throw new Error(
            "This reset link is missing its token. Request a new one."
          );
        await resetPassword.mutateAsync({ token: resetToken, password });
        setMode("signin");
        setPassword("");
        setSuccess("Password updated. Sign in with your new password.");
        if (typeof window !== "undefined")
          window.history.replaceState(null, "", "#login");
        return;
      }
      await login.mutateAsync({ email, password });
      await utils.auth.me.invalidate();
      onSignIn();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your request could not be completed. Please try again."
      );
    }
  };

  const resendVerification = async () => {
    clearFeedback();
    try {
      await requestVerification.mutateAsync({ email });
      setSuccess(
        "If the account is eligible, a fresh verification link is on its way."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not resend the verification link."
      );
    }
  };

  const title =
    mode === "register"
      ? "Create your study space."
      : mode === "forgot"
        ? "Recover your access."
        : mode === "reset"
          ? "Choose a new password."
          : mode === "verify"
            ? "Confirm your email."
            : "Enter with intention.";
  const detail =
    mode === "register"
      ? "Start with four free mock-test starts each calendar month."
      : mode === "forgot"
        ? "We will send a single-use reset link if the account exists."
        : mode === "reset"
          ? "Use at least 12 characters. The password is stored only as a server-side hash."
          : mode === "verify"
            ? "Verification links expire and can only be used once."
            : "Your password is transmitted over HTTPS and stored only as a server-side hash.";

  const changeMode = (next: AuthMode) => {
    setMode(next);
    clearFeedback();
  };

  const standardTabs = mode === "signin" || mode === "register";
  const showEmail = mode !== "reset" && mode !== "verify";
  const showPassword = mode !== "forgot" && mode !== "verify";

  return (
    <div className="study-hero min-h-screen overflow-hidden bg-[#06353a] text-white">
      <div
        className="study-video-overlay absolute inset-0 z-0"
        style={{ backgroundColor: "rgba(5, 47, 53, 0.9)" }}
      />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <button
          onClick={() => onNavigate("dashboard")}
          className="font-display text-[28px] tracking-[-0.05em] text-white"
        >
          MockE
          <sup className="ml-0.5 align-super font-sans text-[9px] tracking-normal">
            ®
          </sup>
        </button>
        <button
          onClick={() => onNavigate(authenticated ? "profile" : "dashboard")}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/75 hover:bg-white/10"
        >
          {authenticated ? "Open profile" : "Back to study"}
        </button>
      </header>
      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-98px)] max-w-5xl place-items-center px-5 pb-16 sm:px-8">
        <section className="w-full max-w-md rounded-[28px] border border-white/20 bg-[#003447]/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#f3ca85]">
            Secure account access
          </p>
          <h1 className="mt-3 font-display text-5xl leading-[0.94] tracking-[-0.05em] text-white">
            {title}
          </h1>
          <p className="mt-5 text-sm leading-6 text-white/65">{detail}</p>
          {authenticated ? (
            <button
              onClick={() => onNavigate("profile")}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-[#003447]"
            >
              Open your profile
            </button>
          ) : (
            <>
              {standardTabs ? (
                <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.06] p-1">
                  <button
                    onClick={() => changeMode("signin")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "signin" ? "bg-white text-[#003447]" : "text-white/70"}`}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => changeMode("register")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === "register" ? "bg-white text-[#003447]" : "text-white/70"}`}
                  >
                    Create account
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => changeMode("signin")}
                  className="mt-7 text-xs font-semibold text-[#f3ca85] hover:text-white"
                >
                  ← Back to sign in
                </button>
              )}
              {mode === "verify" ? (
                <div className="mt-7 rounded-2xl border border-white/15 bg-white/[0.05] p-5 text-center">
                  <MailCheck className="mx-auto size-8 text-[#f3ca85]" />
                  {verifyEmail.isPending ? (
                    <p className="mt-3 text-sm text-white/70">
                      Checking your verification link…
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-white/70">
                      {verifyEmail.isSuccess
                        ? "Your email is verified."
                        : "The link could not be completed. Request a new one below."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => changeMode("signin")}
                    className="mt-5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#003447]"
                  >
                    Continue to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-4 grid gap-3">
                  {mode === "register" && (
                    <Field
                      label="Your name"
                      value={name}
                      onChange={setName}
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                    />
                  )}
                  {showEmail && (
                    <Field
                      label="Email address"
                      value={email}
                      onChange={setEmail}
                      type="email"
                      autoComplete="email"
                    />
                  )}
                  {showPassword && (
                    <Field
                      label={mode === "reset" ? "New password" : "Password"}
                      value={password}
                      onChange={setPassword}
                      type="password"
                      minLength={
                        mode === "register" || mode === "reset" ? 12 : 1
                      }
                      maxLength={200}
                      autoComplete={
                        mode === "register" || mode === "reset"
                          ? "new-password"
                          : "current-password"
                      }
                    />
                  )}
                  {mode === "register" && (
                    <p className="text-[11px] leading-4 text-white/50">
                      Use at least 12 characters. It is never stored in the
                      browser.
                    </p>
                  )}
                  {message && (
                    <p
                      role="alert"
                      className="rounded-lg border border-[#ffd0c8]/35 bg-[#ffebe8]/10 px-3 py-2 text-xs text-[#ffe5df]"
                    >
                      {message}
                    </p>
                  )}
                  {success && (
                    <p
                      role="status"
                      className="rounded-lg border border-[#bbf2d5]/30 bg-[#bbf2d5]/10 px-3 py-2 text-xs text-[#d8ffe6]"
                    >
                      {success}
                    </p>
                  )}
                  <button
                    disabled={pending}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-[#003447] disabled:opacity-60"
                  >
                    <LockKeyhole className="size-4" />
                    {pending
                      ? "Please wait…"
                      : mode === "register"
                        ? "Create account"
                        : mode === "forgot"
                          ? "Send reset link"
                          : mode === "reset"
                            ? "Update password"
                            : "Sign in securely"}
                  </button>
                </form>
              )}
              {standardTabs && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => changeMode("forgot")}
                    className="text-white/60 hover:text-white"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={resendVerification}
                    disabled={!email || requestVerification.isPending}
                    className="inline-flex items-center gap-1 text-white/60 hover:text-white disabled:opacity-40"
                  >
                    <RotateCcw className="size-3" />
                    Resend verification
                  </button>
                </div>
              )}
            </>
          )}
          <div className="my-6 h-px bg-white/15" />
          <p className="flex items-start gap-2 text-center text-xs leading-5 text-white/50">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Account, payment, AI, storage, and queue credentials stay
            server-side in your own environment.
          </p>
        </section>
      </main>
    </div>
  );
}
