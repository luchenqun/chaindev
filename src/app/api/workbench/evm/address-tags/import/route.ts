import { z } from 'zod';
import { importedEvmAddressTagSchema } from '@/server/schemas/workbench-migration';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';
import { importServerEvmAddressTags } from '@/server/repositories/evm-address-tags';

const importEvmAddressTagsSchema = z.object({
  tags: z.array(importedEvmAddressTagSchema),
});

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = importEvmAddressTagsSchema.parse(await request.json());
    return ok(await importServerEvmAddressTags(userId, body.tags));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
