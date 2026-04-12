import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { verifyPassword } from "@/server/auth/password";
import { findAuthUserByEmail } from "@/server/repositories/auth-users";

const providers = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");

      if (!email || !password) {
        return null;
      }

      const user = await findAuthUserByEmail(email);

      if (!user?.passwordHash || !user.email || !verifyPassword(password, user.passwordHash)) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username ?? user.name ?? user.email,
        name: user.username ?? user.name ?? user.email,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: {
    strategy: "jwt",
  },
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.username = (user as { username?: string }).username ?? user.name ?? undefined;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; username?: string }).id = token.sub;
        (session.user as { id?: string; username?: string }).username =
          (token as { username?: string }).username ?? session.user.name ?? undefined;
        session.user.name = (token as { username?: string }).username ?? session.user.name;
      }

      return session;
    },
  },
  trustHost: true,
});
