import { z } from 'zod';
import { importedRpcProfileSchema } from '@/server/schemas/workbench-migration';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';
import { importRpcProfiles } from '@/server/repositories/rpc-profiles';

const importRpcProfilesSchema = z.object({
  profiles: z.array(importedRpcProfileSchema),
});

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = importRpcProfilesSchema.parse(await request.json());
    return ok(await importRpcProfiles(userId, body.profiles));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
