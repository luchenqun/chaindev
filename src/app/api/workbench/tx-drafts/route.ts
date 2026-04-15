import { addTxDraft, listTxDrafts } from '@/server/repositories/tx-drafts';
import { fail, ok } from '@/server/utils/api-response';
import { normalizeApiError } from '@/server/utils/error-normalizer';
import { requireSessionUserId } from '@/server/utils/auth-user';

export async function GET() {
  const userId = await requireSessionUserId();

  if (!userId) {
    return fail({ category: 'auth', message: 'Unauthorized' }, 401);
  }

  return ok(await listTxDrafts(userId));
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: 'auth', message: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as {
      mode: string;
      title: string;
      payloadJson: string;
    };

    return ok(await addTxDraft({ userId, ...body }));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
