import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db/client';
import { verifyPassword } from '@/server/auth/password';
import { findAuthUserByIdentifier } from '@/server/repositories/auth-users';

const providers = [
  Credentials({
    name: 'Credentials',
    credentials: {
      identifier: { label: 'Username or Email', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const identifier = String(credentials?.identifier ?? '').trim();
      const password = String(credentials?.password ?? '');

      if (!identifier || !password) {
        return null;
      }

      const user = await findAuthUserByIdentifier(identifier);

      if (
        !user?.passwordHash ||
        !user.email ||
        !verifyPassword(password, user.passwordHash)
      ) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        username: user.username ?? user.name ?? user.email,
        name: user.username ?? user.name ?? user.email,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: {
    strategy: 'jwt',
  },
  providers,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
        token.username =
          (user as { username?: string }).username ?? user.name ?? undefined;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (
          session.user as { id?: string; username?: string; isAdmin?: boolean }
        ).id = token.sub;
        (
          session.user as { id?: string; username?: string; isAdmin?: boolean }
        ).username =
          (token as { username?: string }).username ??
          session.user.name ??
          undefined;
        (
          session.user as { id?: string; username?: string; isAdmin?: boolean }
        ).isAdmin = Boolean((token as { isAdmin?: boolean }).isAdmin);
        session.user.name =
          (token as { username?: string }).username ?? session.user.name;
      }

      return session;
    },
  },
  trustHost: true,
});
