import { fail, ok } from "@/server/utils/api-response";
import { normalizeApiError } from "@/server/utils/error-normalizer";
import { requireSessionUserId } from "@/server/utils/auth-user";
import {
  listServerEvmContractArtifacts,
  listServerEvmContractBindings,
} from "@/server/repositories/evm-contract-registry";

export async function GET() {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: "auth", message: "Unauthorized" }, 401);
    }

    return ok({
      artifacts: await listServerEvmContractArtifacts(userId),
      bindings: await listServerEvmContractBindings(userId),
    });
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
