import { auth } from "@/auth";

export async function requireSessionUserId() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  return userId;
}
