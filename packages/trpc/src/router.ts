import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  createRefreshSession,
} from "@truly/auth";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true })),

  auth: t.router({
    signup: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          username: z.string().min(3),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.prisma) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const password = await hashPassword(input.password);

        try {
          const user = await ctx.prisma.user.create({
            data: {
              email: input.email,
              username: input.username,
              password,
            },
          });

          const accessToken = generateAccessToken(user.id);
          const refresh = await createRefreshSession(ctx.prisma, user.id);

          return {
            user: { id: user.id, email: user.email, username: user.username },
            accessToken,
            refreshToken: refresh.token,
            refreshTokenExpiresAt: refresh.expiresAt,
          };
        } catch (err: any) {
          if (err?.code === "P2002") {
            throw new TRPCError({ code: "CONFLICT", message: "Email or username already in use" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
      }),

    login: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.prisma) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const user = await ctx.prisma.user.findUnique({
          where: { email: input.email },
        });

        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

        const ok = await verifyPassword(input.password, user.password);
        if (!ok) throw new TRPCError({ code: "UNAUTHORIZED" });

        const accessToken = generateAccessToken(user.id);
        const refresh = await createRefreshSession(ctx.prisma, user.id);

        return {
          user: { id: user.id, email: user.email, username: user.username },
          accessToken,
          refreshToken: refresh.token,
          refreshTokenExpiresAt: refresh.expiresAt,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
