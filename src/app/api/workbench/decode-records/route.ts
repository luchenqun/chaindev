import { addDecodeRecord, listDecodeRecords } from '@/server/repositories/decode-records';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';

export async function GET() {
  const userId = await requireSessionUserId();

  if (!userId) {
    return fail({ category: 'auth', message: 'Unauthorized' }, 401);
  }

  return ok(await listDecodeRecords(userId));
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as {
      mode: string;
      decoder: string;
      input: string;
      outputJson: string;
    };

    return ok(await addDecodeRecord({ userId, ...body }));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
