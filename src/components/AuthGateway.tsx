import { ArrowLeft, CheckCircle2, Eye, EyeOff, Gamepad2, LoaderCircle, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  checkUsernameAvailability,
  signInAccount,
  signUpAccount,
  linkGuestProgress,
  USERNAME_PATTERN,
  type AccountProfile,
} from "@/lib/authService";
import { DEFAULT_GARAGE_SAVE, normalizeGarageSave, type GarageSaveData } from "@/lib/garageSave";
import { supabaseConfigured } from "@/lib/supabase";

type AuthGatewayProps = {
  open: boolean;
  mode: "start" | "link";
  guestSaveData?: GarageSaveData;
  onClose: () => void;
  onContinueGuest?: () => void | Promise<void>;
  onAuthenticated: (account: AccountProfile) => void | Promise<void>;
};

type AuthView = "choices" | "signin" | "signup";
type UsernameState = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AuthGateway({
  open,
  mode,
  guestSaveData = DEFAULT_GARAGE_SAVE,
  onClose,
  onContinueGuest,
  onAuthenticated,
}: AuthGatewayProps) {
  const [view, setView] = useState<AuthView>("choices");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView("choices");
    setUsername("");
    setEmail("");
    setIdentity("");
    setPassword("");
    setConfirmPassword("");
    setUsernameState("idle");
    setUsernameMessage("");
    setError("");
    setNotice("");
  }, [open, mode]);

  useEffect(() => {
    if (!open || view !== "signup") return;
    const candidate = username.trim();
    if (!candidate) {
      setUsernameState("idle");
      setUsernameMessage("");
      return;
    }
    if (!USERNAME_PATTERN.test(candidate)) {
      setUsernameState("invalid");
      setUsernameMessage("Use 3–20 letters, numbers, or underscores.");
      return;
    }
    if (!supabaseConfigured) {
      setUsernameState("error");
      setUsernameMessage("Username checks need the Supabase project configuration.");
      return;
    }
    setUsernameState("checking");
    setUsernameMessage("Checking username availability…");
    let current = true;
    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(candidate).then((available) => {
        if (!current) return;
        setUsernameState(available ? "available" : "taken");
        setUsernameMessage(available ? "Username is available." : `Username '${candidate}' is already registered.`);
      }).catch((availabilityError) => {
        if (!current) return;
        setUsernameState("error");
        setUsernameMessage(errorText(availabilityError));
      });
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [open, view, username]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const acceptAccount = async (account: AccountProfile) => {
    await onAuthenticated(account);
    onClose();
  };

  const submitSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      let account = await signInAccount(identity, password);
      if (mode === "link") {
        const saveData = await linkGuestProgress(account.userId, normalizeGarageSave(guestSaveData));
        account = { ...account, saveData };
      }
      await acceptAccount(account);
    } catch (signInError) {
      setError(errorText(signInError));
    } finally {
      setLoading(false);
    }
  };

  const submitSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const candidate = username.trim();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (usernameState === "taken") {
      setError(`Username '${candidate}' is already registered.`);
      return;
    }
    if (!USERNAME_PATTERN.test(candidate)) {
      setError("Use 3–20 letters, numbers, or underscores for the username.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUpAccount({
        username: candidate,
        email,
        password,
        saveData: normalizeGarageSave(guestSaveData),
      });
      if (result.confirmationRequired || !result.account) {
        setNotice("Account created. Check your email to confirm it, then sign in to load your cloud garage.");
        setView("signin");
        setIdentity(email);
        return;
      }
      let account = result.account;
      if (mode === "link") {
        const saveData = await linkGuestProgress(account.userId, normalizeGarageSave(guestSaveData));
        account = { ...account, saveData };
      }
      await acceptAccount(account);
    } catch (signUpError) {
      setError(errorText(signUpError));
    } finally {
      setLoading(false);
    }
  };

  const changeView = (nextView: AuthView) => {
    setError("");
    setNotice("");
    setView(nextView);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483100] grid place-items-center overflow-y-auto bg-[#020408]/90 px-4 py-6 backdrop-blur-lg"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gateway-title"
        className="atelier-panel relative my-auto w-full max-w-lg rounded-3xl border border-white/12 p-5 shadow-[0_30px_120px_rgba(0,0,0,.8)] sm:p-7"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={onClose} disabled={loading} aria-label={mode === "link" ? "Skip account linking" : "Return to main menu"} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">×</button>
        <div className="font-mono-tech text-[9px] font-bold uppercase tracking-[.2em] text-sky-200">{mode === "link" ? "Guest account binding" : "Driver identity"}</div>
        <h2 id="auth-gateway-title" className="mt-2 pr-10 font-display text-2xl font-bold text-white">{mode === "link" ? "Convert Guest to Account" : "Enter the grid"}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
          {mode === "link" ? "Save your current garage, customizations and settings to an account. You can close this window and keep playing as a guest." : "Choose a guest session or sign in to restore your cloud garage."}
        </p>

        {view === "choices" ? (
          <div className="mt-6 space-y-3">
            {mode === "start" && <button type="button" onClick={onContinueGuest} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-[#F5C518]/35 bg-[#F5C518]/10 px-4 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.14em] text-amber-100 transition-colors hover:bg-[#F5C518]/15"><Gamepad2 className="h-4 w-4" /> CONTINUE AS GUEST</button>}
            <button type="button" onClick={() => changeView("signin")} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-sky-200/30 bg-sky-300/10 px-4 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.14em] text-sky-100 transition-colors hover:bg-sky-300/15"><ShieldCheck className="h-4 w-4" />{mode === "link" ? "SIGN IN TO EXISTING ACCOUNT" : "SIGN IN"}</button>
            <button type="button" onClick={() => changeView("signup")} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[.03] px-4 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.14em] text-zinc-100 transition-colors hover:bg-white/[.08]"><UserRoundPlus className="h-4 w-4" />{mode === "link" ? "CREATE NEW ACCOUNT" : "SIGN UP"}</button>
            {mode === "link" && <button type="button" onClick={onClose} className="w-full rounded-xl px-4 py-3 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-500 transition-colors hover:text-white">SKIP FOR NOW · CONTINUE AS GUEST</button>}
            {!supabaseConfigured && <div role="status" className="rounded-xl border border-amber-200/15 bg-amber-200/[.04] px-3 py-2 text-[10px] leading-relaxed text-amber-100/75">Cloud sign-in is not configured yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or the legacy <code>VITE_SUPABASE_ANON_KEY</code>) after completing the setup guide.</div>}
          </div>
        ) : view === "signin" ? (
          <form className="mt-6 space-y-4" onSubmit={submitSignIn}>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => changeView("choices")} className="inline-flex items-center gap-1.5 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Back</button>
              <span className="font-mono-tech text-[8px] uppercase tracking-wider text-zinc-600">Email or username</span>
            </div>
            <label className="block font-mono-tech text-[9px] uppercase tracking-[.15em] text-zinc-400">Email or username
              <input required autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 font-display text-sm normal-case tracking-normal text-white outline-none transition-colors focus:border-sky-200/50" placeholder="ApexRacer or racer@email.com" />
            </label>
            <label className="block font-mono-tech text-[9px] uppercase tracking-[.15em] text-zinc-400">Password
              <span className="relative mt-1.5 block"><input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 pr-11 font-display text-sm normal-case tracking-normal text-white outline-none transition-colors focus:border-sky-200/50" placeholder="Your password" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-2 grid w-8 place-items-center text-zinc-500 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
            {notice && <div role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/[.06] px-3 py-2 text-xs text-emerald-100">{notice}</div>}
            {error && <div role="alert" className="rounded-lg border border-red-300/20 bg-red-400/[.06] px-3 py-2 text-xs text-red-200">{error}</div>}
            <button type="submit" disabled={loading || !supabaseConfigured} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-300/20 px-4 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.16em] text-sky-50 transition-colors hover:bg-sky-300/30 disabled:cursor-not-allowed disabled:opacity-40">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} SIGN IN</button>
            <p className="text-center text-[10px] text-zinc-600">New driver? <button type="button" onClick={() => changeView("signup")} className="font-semibold text-sky-200 hover:text-white">Create an account</button></p>
          </form>
        ) : (
          <form className="mt-6 space-y-3.5" onSubmit={submitSignUp}>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => changeView("choices")} className="inline-flex items-center gap-1.5 font-mono-tech text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Back</button>
              <span className="font-mono-tech text-[8px] uppercase tracking-wider text-zinc-600">Create profile</span>
            </div>
            <label className="block font-mono-tech text-[9px] uppercase tracking-[.15em] text-zinc-400">Username
              <input required minLength={3} maxLength={20} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^A-Za-z0-9_]/g, ""))} className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 font-display text-sm normal-case tracking-normal text-white outline-none transition-colors focus:border-sky-200/50" placeholder="ApexRacer" aria-describedby="username-availability" />
              <span id="username-availability" aria-live="polite" className={`mt-1 block min-h-4 text-[10px] ${usernameState === "taken" || usernameState === "invalid" || usernameState === "error" ? "text-red-200" : usernameState === "available" ? "text-emerald-200" : "text-zinc-500"}`}>{usernameMessage}</span>
            </label>
            <label className="block font-mono-tech text-[9px] uppercase tracking-[.15em] text-zinc-400">Email
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 font-display text-sm normal-case tracking-normal text-white outline-none transition-colors focus:border-sky-200/50" placeholder="you@example.com" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-mono-tech text-[9px] uppercase tracking-[.15em] text-zinc-400">Password
                <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 font-display text-sm normal-case tracking-normal text-white outline-none transition-colors focus:border-sky-200/50" placeholder="8+ characters" />
              </label>
              <label className="block font-mono-tech text-[9px] uppercase tracking-[.15em] text-zinc-400">Confirm password
                <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 font-display text-sm normal-case tracking-normal text-white outline-none transition-colors focus:border-sky-200/50" placeholder="Repeat password" />
              </label>
            </div>
            {error && <div role="alert" className="rounded-lg border border-red-300/20 bg-red-400/[.06] px-3 py-2 text-xs text-red-200">{error}</div>}
            {notice && <div role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/[.06] px-3 py-2 text-xs text-emerald-100">{notice}</div>}
            <button type="submit" disabled={loading || !supabaseConfigured || usernameState === "checking" || usernameState === "taken" || usernameState === "invalid" || usernameState === "error"} className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#DC1A22] px-4 py-3 font-mono-tech text-[10px] font-bold uppercase tracking-[.16em] text-white transition-colors hover:bg-[#b9151c] disabled:cursor-not-allowed disabled:opacity-40">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{mode === "link" ? "CREATE ACCOUNT & SAVE GARAGE" : "CREATE ACCOUNT"}</button>
            <p className="text-center text-[9px] leading-relaxed text-zinc-600">Your garage save is attached to the account. Never share your password or service keys.</p>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}
