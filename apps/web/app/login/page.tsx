"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import Link from "next/link";
import { trpc } from "@/src/lib/trpc";

const LANDING_URL = process.env["NEXT_PUBLIC_LANDING_URL"] ?? "http://localhost:3100";

type LoginResult = {
  user?: { id: string; email: string; username: string };
  accessToken?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LoginResult | null>(null);

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await trpc.auth.login.mutate({ email, password });
      setResult({ user: response.user, accessToken: response.accessToken });
    } catch (loginError: unknown) {
      const message = loginError instanceof Error ? loginError.message : "Login failed";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: 24,
        minHeight: "100vh",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <a
            href={LANDING_URL}
            style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", textDecoration: "none" }}
          >
            Truly
          </a>
        </div>

        <h1 style={{ margin: 0, fontSize: 22 }}>Sign in</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Welcome back. Enter your credentials to continue.
        </p>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#4b5563" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="you@example.com"
            required
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 16,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#4b5563" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="••••••••"
            required
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 16,
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            borderRadius: 8,
            border: "none",
            padding: "12px 16px",
            background: "#2563eb",
            color: "white",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error ? <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }}>{error}</p> : null}

        {result?.user ? (
          <pre
            style={{
              margin: 0,
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}

        <p style={{ margin: 0, textAlign: "center", fontSize: 14, color: "#64748b" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "#2563eb", fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
