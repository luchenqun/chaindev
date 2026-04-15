import { z } from 'zod';
import {
  createServerEvmPrivateKey,
  deleteServerEvmPrivateKey,
  listServerEvmPrivateKeys,
  renameServerEvmPrivateKey,
  touchServerEvmPrivateKeyLastUsed,
  unlockServerEvmPrivateKey,
  updateServerEvmPrivateKey,
} from '@/server/repositories/evm-private-keys';
import { fail, ok } from '@/server/utils/api-response';
import { requireSessionUserId } from '@/server/utils/auth-user';
import { normalizeApiError } from '@/server/utils/error-normalizer';

const createPrivateKeySchema = z
  .object({
    name: z.string().trim().min(1, 'Key name is required.'),
    privateKey: z.string().trim().min(1, 'Private key is required.'),
    securityMode: z.enum(['plain', 'encrypted']).default('plain'),
    password: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.securityMode === 'encrypted' && !input.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required for encrypted private keys.',
        path: ['password'],
      });
    }
  });

const renamePrivateKeySchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().trim().min(1, 'Key name is required.'),
});

const touchPrivateKeySchema = z.object({
  id: z.string().min(1, 'id is required'),
  action: z.literal('touch'),
});

const unlockPrivateKeySchema = z.object({
  id: z.string().min(1, 'id is required'),
  action: z.literal('unlock'),
  password: z.string().min(1, 'Password is required.'),
});

const updatePrivateKeySchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    action: z.literal('update'),
    name: z.string().trim().min(1, 'Key name is required.'),
    privateKey: z.string().trim().min(1, 'Private key is required.'),
    securityMode: z.enum(['plain', 'encrypted']),
    password: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.securityMode === 'encrypted' && !input.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required for encrypted private keys.',
        path: ['password'],
      });
    }
  });

export async function GET() {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    return ok(await listServerEvmPrivateKeys(userId));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = createPrivateKeySchema.parse(await request.json());
    return ok(await createServerEvmPrivateKey({ userId, ...body }));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const rawBody = await request.json();
    const touchPayload = touchPrivateKeySchema.safeParse(rawBody);

    if (touchPayload.success) {
      const item = await touchServerEvmPrivateKeyLastUsed(
        userId,
        touchPayload.data.id,
      );

      if (!item) {
        return fail(
          { category: 'validation', message: 'Private key entry not found.' },
          404,
        );
      }

      return ok(item);
    }

    const unlockPayload = unlockPrivateKeySchema.safeParse(rawBody);

    if (unlockPayload.success) {
      const unlocked = await unlockServerEvmPrivateKey(
        userId,
        unlockPayload.data.id,
        unlockPayload.data.password,
      );

      if (!unlocked) {
        return fail(
          { category: 'validation', message: 'Private key entry not found.' },
          404,
        );
      }

      return ok(unlocked);
    }

    const updatePayload = updatePrivateKeySchema.safeParse(rawBody);

    if (updatePayload.success) {
      const item = await updateServerEvmPrivateKey({
        userId,
        id: updatePayload.data.id,
        name: updatePayload.data.name,
        privateKey: updatePayload.data.privateKey,
        securityMode: updatePayload.data.securityMode,
        password: updatePayload.data.password,
      });

      if (!item) {
        return fail(
          { category: 'validation', message: 'Private key entry not found.' },
          404,
        );
      }

      return ok(item);
    }

    const body = renamePrivateKeySchema.parse(rawBody);
    const item = await renameServerEvmPrivateKey(userId, body.id, body.name);

    if (!item) {
      return fail(
        { category: 'validation', message: 'Private key entry not found.' },
        404,
      );
    }

    return ok(item);
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return fail({ category: 'validation', message: 'id is required' }, 400);
    }

    return ok(await deleteServerEvmPrivateKey(userId, id));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
