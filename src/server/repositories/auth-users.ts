import { randomUUID } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { hashPassword } from "@/server/auth/password";

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });
}

export async function findAuthUserByUsername(username: string) {
  const normalizedUsername = username.trim();
  return db.query.users.findFirst({
    where: eq(users.username, normalizedUsername),
  });
}

export async function findAuthUserConflict(input: { email: string; username: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedUsername = input.username.trim();

  return db.query.users.findFirst({
    where: or(eq(users.email, normalizedEmail), eq(users.username, normalizedUsername)),
  });
}

export async function createCredentialUser(input: {
  email: string;
  username: string;
  password: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedUsername = input.username.trim();
  const id = randomUUID();

  db.insert(users)
    .values({
      id,
      email: normalizedEmail,
      username: normalizedUsername,
      name: normalizedUsername,
      passwordHash: hashPassword(input.password),
      emailVerified: new Date(),
    })
    .run();

  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
