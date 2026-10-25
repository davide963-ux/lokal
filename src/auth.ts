import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { verifyCredentials } from "@/lib/credentials";
import { clientIp } from "@/lib/rate-limit";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const result = await verifyCredentials(credentials, clientIp(request.headers));
        if (result.ok) return result.user;
        if (result.reason === "rate_limited") throw new RateLimitedError();
        return null;
      },
    }),
  ],
});
