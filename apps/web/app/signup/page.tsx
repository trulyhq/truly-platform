"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import Link from "next/link";
import { trpc } from "@/src/lib/trpc";

const LANDING_URL = process.env["NEXT_PUBLIC_LANDING_URL"] ?? "http://localhost:3100";

type SignupResult = {
  user?: { id: string; email: string; username: string };
  accessToken?: string;
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
  }

  function handleUsernameChange(event: ChangeEvent<HTMLInputElement>) {
    setUsername(event.target.value);
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await trpc.auth.signup.mutate({
        email,
        username,
        password,
      });
      setResult({ user: response.user, accessToken: response.accessToken });
    } catch (signupError: unknown) {
      const message = signupError instanceof Error ? signupError.message : "Signup failed";
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
        onSubmit={handleSignup}
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

        <h1 style={{ margin: 0, fontSize: 22 }}>Create your account</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Get started for free. No credit card required.
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
          <span style={{ fontSize: 14, color: "#4b5563" }}>Username</span>
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="johndoe"
            required
            minLength={3}
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
            minLength={8}
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
          {loading ? "Creating account…" : "Create account"}
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
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
