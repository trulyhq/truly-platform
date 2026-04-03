import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Input } from "@truly/ui";
import { trpc } from "../src/lib/trpc";

type LoginResult = {
  user?: { id: string; email: string; username: string };
  accessToken?: string;
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LoginResult | null>(null);

  async function handleLogin() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: "#0f172a" }}>
          Truly Mobile Login
        </Text>
        <Text style={{ color: "#64748b" }}>
          Uses EXPO_PUBLIC_API_URL or deployed API fallback.
        </Text>

        <Input
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Input
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button label={loading ? "Signing in..." : "Sign in"} onPress={handleLogin} />

        {error ? <Text style={{ color: "#dc2626" }}>{error}</Text> : null}

        {result?.user ? (
          <View
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 8,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ color: "#e2e8f0" }}>User: {result.user.email}</Text>
            <Text style={{ color: "#e2e8f0" }}>ID: {result.user.id}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
