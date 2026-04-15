import { z } from 'zod';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUser } from '@/server/utils/auth-user';
import {
  createServerEvmContractArtifact,
  createServerEvmContractBinding,
  deleteServerEvmContractArtifact,
  deleteServerEvmContractBinding,
  listServerEvmContractArtifacts,
  listServerEvmContractBindings,
  updateServerEvmContractArtifact,
  updateServerEvmContractBinding,
} from '@/server/repositories/evm-contract-registry';

const artifactPayloadSchema = z.object({
  kind: z.literal('artifact'),
  scope: z.enum(['system', 'user']).default('user'),
  name: z.string().trim().min(1, 'Contract name is required.'),
  abiJson: z.string().trim().min(1, 'ABI is required.'),
  bytecode: z.string().trim().nullable(),
});

const bindingPayloadSchema = z.object({
  kind: z.literal('binding'),
  artifactId: z.string().trim().min(1, 'Select a saved artifact first.'),
  address: z.string().trim().min(1, 'Contract address is required.'),
  label: z.string().trim().min(1),
  chainId: z.string().trim().min(1),
  providerProfileId: z.string().trim().min(1),
  providerName: z.string().trim().min(1),
});

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();

    if (!sessionUser) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    return ok({
      artifacts: await listServerEvmContractArtifacts(sessionUser.id),
      bindings: await listServerEvmContractBindings(sessionUser.id),
    });
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSessionUser();

    if (!sessionUser) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as unknown;
    const artifactPayload = artifactPayloadSchema.safeParse(body);

    if (artifactPayload.success) {
      return ok(
        await createServerEvmContractArtifact({
          userId: sessionUser.id,
          isAdmin: sessionUser.isAdmin,
          ...artifactPayload.data,
        }),
      );
    }

    const bindingPayload = bindingPayloadSchema.parse(body);
    return ok(
      await createServerEvmContractBinding({
        userId: sessionUser.id,
        ...bindingPayload,
      }),
    );
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireSessionUser();

    if (!sessionUser) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as { id?: string; payload?: unknown };

    if (!body.id) {
      return fail({ category: 'validation', message: 'id is required' }, 400);
    }

    const artifactPayload = artifactPayloadSchema.safeParse(body.payload);

    if (artifactPayload.success) {
      const item = await updateServerEvmContractArtifact({
        userId: sessionUser.id,
        isAdmin: sessionUser.isAdmin,
        id: body.id,
        ...artifactPayload.data,
      });

      if (!item) {
        return fail(
          { category: 'validation', message: 'Contract artifact not found.' },
          404,
        );
      }

      return ok(item);
    }

    const bindingPayload = bindingPayloadSchema.parse(body.payload);
    const item = await updateServerEvmContractBinding({
      userId: sessionUser.id,
      id: body.id,
      ...bindingPayload,
    });

    if (!item) {
      return fail(
        { category: 'validation', message: 'Bound contract not found.' },
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
    const sessionUser = await requireSessionUser();

    if (!sessionUser) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const kind = url.searchParams.get('kind');

    if (!id || !kind) {
      return fail(
        { category: 'validation', message: 'id and kind are required' },
        400,
      );
    }

    if (kind === 'artifact') {
      return ok(
        await deleteServerEvmContractArtifact(
          sessionUser.id,
          id,
          sessionUser.isAdmin,
        ),
      );
    }

    if (kind === 'binding') {
      return ok(await deleteServerEvmContractBinding(sessionUser.id, id));
    }

    return fail({ category: 'validation', message: 'Unsupported kind' }, 400);
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
