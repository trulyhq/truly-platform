import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@truly/trpc";

const API_URL =
  process.env["EXPO_PUBLIC_API_URL"] ?? "https://d7xox33u8g.execute-api.eu-west-1.amazonaws.com";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
    }),
  ],
});
