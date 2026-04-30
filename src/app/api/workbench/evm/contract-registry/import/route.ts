import { z } from 'zod';
import { importedEvmContractArtifactSchema, importedEvmContractBindingSchema } from '@/server/schemas/workbench-import';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';
import { importServerEvmContractRegistry } from '@/server/repositories/evm-contract-registry';

const importEvmContractRegistrySchema = z.object({
  artifacts: z.array(importedEvmContractArtifactSchema),
  bindings: z.array(importedEvmContractBindingSchema),
});

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = importEvmContractRegistrySchema.parse(await request.json());
    return ok(await importServerEvmContractRegistry(userId, body));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
