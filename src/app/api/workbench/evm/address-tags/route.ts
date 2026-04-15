import { z } from 'zod';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';
import {
  clearServerEvmAddressTags,
  deleteServerEvmAddressTag,
  listServerEvmAddressTags,
  upsertServerEvmAddressTag,
} from '@/server/repositories/evm-address-tags';

const upsertTagSchema = z.object({
  providerProfileId: z.string().trim().min(1, 'providerProfileId is required'),
  providerName: z.string().trim().nullable().optional(),
  address: z.string().trim().min(1, 'address is required'),
  nameTag: z.string().trim().min(1, 'Name tag is required.'),
});

export async function GET() {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    return ok(await listServerEvmAddressTags(userId));
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

    const body = upsertTagSchema.parse(await request.json());
    return ok(
      await upsertServerEvmAddressTag({
        userId,
        ...body,
        providerName: body.providerName ?? null,
      }),
    );
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
    const providerProfileId = url.searchParams.get('providerProfileId');
    const address = url.searchParams.get('address');
    const clear = url.searchParams.get('clear');

    if (!providerProfileId) {
      return fail(
        { category: 'validation', message: 'providerProfileId is required' },
        400,
      );
    }

    if (clear === '1') {
      return ok(await clearServerEvmAddressTags(userId, providerProfileId));
    }

    if (!address) {
      return fail(
        { category: 'validation', message: 'address is required' },
        400,
      );
    }

    return ok(
      await deleteServerEvmAddressTag({ userId, providerProfileId, address }),
    );
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
