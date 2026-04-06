# The Custom Access + Refresh Token Implementation Plan

This plan defines the authentication implementation for `packages/auth` using `@oslojs` low-level primitives while fully owning the auth logic.

## 1. Database Schema (`packages/database/prisma/schema.prisma`)

We use a user table plus a refresh-session table. Access tokens are short-lived and stateless; refresh tokens are persisted (hashed) for rotation and revocation.

```prisma
model User {
  id           String           @id
  email        String           @unique
  passwordHash String
  sessions     RefreshSession[]
  // Add fields like firstName, kycStatus, etc.
}

model RefreshSession {
  id            String   @id
  userId        String
  tokenHash     String   @unique
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  rotatedFromId String?
  revokedAt     DateTime?
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

## 2. Token Manager (`packages/auth/src/tokens.ts`)

Core responsibilities:

- `createAccessToken(userId, claims)`: issue short-lived Bearer token (e.g. 10-15 min)
- `verifyAccessToken(token)`: validate signature, expiry, and claims
- `createRefreshToken(userId)`: create opaque token, hash before storing in DB
- `rotateRefreshToken(oldToken)`: invalidate old session and create new one
- `revokeRefreshToken(tokenOrSessionId)`: logout one session
- `revokeAllUserSessions(userId)`: logout all devices if needed

## 3. Password Manager (`packages/auth/src/password.ts`)

Use Argon2id:

- `hashPassword(plain)`
- `verifyPassword(hash, plain)`

## 4. Cookie Handler (`packages/auth/src/cookies.ts`)

Refresh token cookie only:

- `HttpOnly`
- `Secure` (production)
- `SameSite=Lax`
- `Path=/`
- explicit `Max-Age` / expiry aligned with refresh session TTL

## 5. Auth Flow Contract

- **Login/Signup**
  - verify credentials or create user
  - issue access token in response body
  - set refresh token in HttpOnly cookie

- **Refresh**
  - read refresh cookie
  - validate + rotate refresh session
  - return new access token
  - set new refresh cookie

- **Logout**
  - revoke refresh session
  - clear refresh cookie

## 6. Client Storage Strategy

- Access token: memory-only on web (rehydrate via refresh on reload)
- Refresh token: cookie-managed (never readable by client JS)
- Mobile strategy can reuse Bearer access token flow with secure storage for refresh token if cookie transport is unavailable
