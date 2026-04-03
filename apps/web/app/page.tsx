"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { trpc } from "@/src/lib/trpc";

type LoginResult = {
  user?: { id: string; email: string; username: string };
  accessToken?: string;
};

export default function Page() {
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
      const message =
        loginError instanceof Error ? loginError.message : "Login failed";
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
        <h1 style={{ margin: 0, fontSize: 22 }}>Truly Login</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Phase 4 web app is wired to your deployed tRPC API.
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
            cursor: "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error ? (
          <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }}>{error}</p>
        ) : null}

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
      </form>
    </main>
  );
}
