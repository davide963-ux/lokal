import type { NextAuthConfig } from "next-auth";

// Edge-safe subset (no database, no bcrypt). Shared by src/auth.ts and src/proxy.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 }, // phones stay signed in for two weeks
  providers: [],
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id!;
        token.role = user.role;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.sessionVersion = token.sv;
      return session;
    },
  },
} satisfies NextAuthConfig;
