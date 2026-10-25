import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      sessionVersion: number;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    sv: number;
  }
}
