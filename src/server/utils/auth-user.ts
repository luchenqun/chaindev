import { auth } from "@/auth";

export async function requireSessionUserId() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  return userId;
}

export async function requireSessionUser() {
  const session = await auth();
  const user = (session?.user as { id?: string; isAdmin?: boolean } | undefined) ?? null;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    isAdmin: Boolean(user.isAdmin),
  };
}
