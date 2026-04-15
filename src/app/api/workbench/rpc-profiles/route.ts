import { rpcProfileDraftSchema } from '@/platform/workbench/rpc-profile';
import {
  addRpcProfile,
  deleteRpcProfile,
  listRpcProfiles,
  updateRpcProfile,
} from '@/server/repositories/rpc-profiles';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';

export async function GET() {
  const userId = await requireSessionUserId();

  if (!userId) {
    return fail({ category: 'auth', message: 'Unauthorized' }, 401);
  }

  return ok(await listRpcProfiles(userId));
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = rpcProfileDraftSchema.parse(await request.json());

    return ok(await addRpcProfile({ userId, ...body }));
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

    return ok(await deleteRpcProfile(userId, id));
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

    const body = (await request.json()) as {
      id?: string;
      profile?: unknown;
    };

    if (!body.id) {
      return fail({ category: 'validation', message: 'id is required' }, 400);
    }

    const profile = rpcProfileDraftSchema.parse(body.profile);
    return ok(await updateRpcProfile(userId, body.id, { userId, ...profile }));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
