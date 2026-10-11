"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { clientAuth, firebaseConfigured } from "@/lib/firebase";
import { Brand } from "@/components/brand";
export default function Auth() {
  const [mode, setMode] = useState<"signin" | "register" | "reset">("signin"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = clientAuth(),
        email = String(data.get("email")),
        password = String(data.get("password"));
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setMessage(
          "If this email has an account, you will receive a password reset link.",
        );
      } else {
        await (mode === "register"
          ? createUserWithEmailAndPassword(auth, email, password)
          : signInWithEmailAndPassword(auth, email, password));
        router.push("/app");
      }
    } catch {
      setError(
        firebaseConfigured
          ? "Sign-in failed. Check your details, enabled Firebase providers, and authorized domain, then retry."
          : "Configure public Firebase client variables in .env.local and restart the app. Explore the local demo while setup is incomplete.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(clientAuth(), new GoogleAuthProvider());
      router.push("/app");
    } catch {
      setError(
        "Google sign-in could not finish. Configure Firebase, enable Google, allow this domain, and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={17} aria-hidden="true" /> Back to TraceReason
      </Link>
      <section className="auth-card">
        <Brand />
        <div className="eyebrow">YOUR PROJECT’S MEMORY STARTS HERE</div>
        <h1>
          {mode === "register"
            ? "Create your account"
            : mode === "reset"
              ? "Reset your password"
              : "Welcome back."}
        </h1>
        <p>Keep the reasoning close to the code.</p>
        {!firebaseConfigured && (
          <div className="notice">
            Firebase is not configured. Sign-in needs the public client and
            server Admin settings.{" "}
            <Link href="/app?mode=demo">Explore local demo</Link>.
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@example.com…"
            />
          </label>
          {mode !== "reset" && (
            <label>
              Password
              <input
                required
                type="password"
                name="password"
                minLength={mode === "register" ? 8 : 1}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                placeholder="Your password…"
              />
            </label>
          )}
          <div role="alert" className="form-error">
            {error}
          </div>
          <div aria-live="polite" className="success-message">
            {message}
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spin" aria-hidden="true" size={17} />{" "}
                Working…
              </>
            ) : (
              <>
                {mode === "register"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
        {mode !== "reset" && (
          <>
            <div className="auth-divider">OR</div>
            <button
              className="button secondary"
              onClick={google}
              disabled={busy}
            >
              Continue with Google
            </button>
          </>
        )}
        <div className="auth-switch">
          <button
            onClick={() => {
              setMode(mode === "register" ? "signin" : "register");
              setError("");
              setMessage("");
            }}
          >
            {mode === "register"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button
            onClick={() => {
              setMode(mode === "reset" ? "signin" : "reset");
              setError("");
              setMessage("");
            }}
          >
            {mode === "reset" ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
      </section>
    </main>
  );
}
