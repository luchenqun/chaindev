import { fail, ok } from "@/server/utils/api-response";
import { normalizeApiError } from "@/server/utils/error-normalizer";
import { requireSessionUserId } from "@/server/utils/auth-user";
import { listServerEvmAddressTags } from "@/server/repositories/evm-address-tags";

export async function GET() {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: "auth", message: "Unauthorized" }, 401);
    }

    return ok(await listServerEvmAddressTags(userId));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
