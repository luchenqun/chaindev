import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema/auth';
import { evmContractArtifacts } from '@/db/schema/workbench';
import { hashPassword } from '@/server/auth/password';
import { createCredentialUser } from '@/server/repositories/auth-users';
import { createServerEvmContractArtifact } from '@/server/repositories/evm-contract-registry';
import { seedDefaultWorkbenchForUser } from '@/server/repositories/workbench-bootstrap';
import { SYSTEM_CONTRACT_ARTIFACTS } from '@/server/system/artifacts/system-contract-artifacts';

type BootstrapAdminConfig = {
  email: string;
  username: string;
  name: string;
  password: string;
};

function getBootstrapAdminConfig(): BootstrapAdminConfig | null {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

  if (!email && !username && !password && !name) {
    return null;
  }

  if (!email || !username || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_USERNAME, and BOOTSTRAP_ADMIN_PASSWORD must be set together.',
    );
  }

  return {
    email: email.toLowerCase(),
    username,
    name: name || username,
    password,
  };
}

async function ensureBootstrapAdminUser(config: BootstrapAdminConfig) {
  const normalizedUsernameLower = config.username.toLowerCase();
  const matchedUsers = await db
    .select()
    .from(users)
    .where(
      or(
        sql`lower(${users.email}) = ${config.email}`,
        sql`lower(${users.username}) = ${normalizedUsernameLower}`,
      ),
    )
    .all();

  const distinctUserIds = [...new Set(matchedUsers.map((user) => user.id))];

  if (distinctUserIds.length > 1) {
    throw new Error(
      'Bootstrap admin identity matches multiple users. Resolve the email/username conflict first.',
    );
  }

  if (matchedUsers[0]) {
    const existingUser = matchedUsers[0];
    const emailMatches = existingUser.email?.toLowerCase() === config.email;
    const usernameMatches =
      existingUser.username?.toLowerCase() === normalizedUsernameLower;
    const nameMatches =
      (existingUser.name ?? existingUser.username ?? '').trim() === config.name;

    if (
      existingUser.isAdmin &&
      emailMatches &&
      usernameMatches &&
      nameMatches
    ) {
      return existingUser;
    }

    db.update(users)
      .set({
        email: config.email,
        username: config.username,
        name: config.name,
        passwordHash: hashPassword(config.password),
        isAdmin: true,
        emailVerified: existingUser.emailVerified ?? new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .run();

    return (
      db.select().from(users).where(eq(users.id, existingUser.id)).get() ?? null
    );
  }

  return createCredentialUser({
    email: config.email,
    username: config.username,
    name: config.name,
    password: config.password,
    isAdmin: true,
  });
}

async function ensureSystemArtifacts(adminUserId: string) {
  const existingSystemArtifactNames = new Set(
    db
      .select({
        name: evmContractArtifacts.name,
      })
      .from(evmContractArtifacts)
      .where(eq(evmContractArtifacts.scope, 'system'))
      .all()
      .map((artifact) => artifact.name),
  );

  for (const artifact of SYSTEM_CONTRACT_ARTIFACTS) {
    if (existingSystemArtifactNames.has(artifact.contractName)) {
      continue;
    }

    await createServerEvmContractArtifact({
      userId: adminUserId,
      isAdmin: true,
      scope: 'system',
      name: artifact.contractName,
      abiJson: artifact.abi,
      bytecode: artifact.bytecode,
    });
  }
}

export async function ensureSystemBootstrap() {
  const config = getBootstrapAdminConfig();

  if (!config) {
    return null;
  }

  const adminUser = await ensureBootstrapAdminUser(config);

  if (!adminUser) {
    throw new Error('Failed to create or load the bootstrap admin user.');
  }

  await seedDefaultWorkbenchForUser(adminUser.id);
  await ensureSystemArtifacts(adminUser.id);

  return adminUser;
}
