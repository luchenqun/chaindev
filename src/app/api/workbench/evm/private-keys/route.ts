import { z } from "zod";
import {
  createServerEvmPrivateKey,
  deleteServerEvmPrivateKey,
  listServerEvmPrivateKeys,
  renameServerEvmPrivateKey,
  touchServerEvmPrivateKeyLastUsed,
} from "@/server/repositories/evm-private-keys";
import { fail, ok } from "@/server/utils/api-response";
import { requireSessionUserId } from "@/server/utils/auth-user";
import { normalizeApiError } from "@/server/utils/error-normalizer";

const createPrivateKeySchema = z.object({
  name: z.string().trim().min(1, "Key name is required."),
  privateKey: z.string().trim().min(1, "Private key is required."),
});

const renamePrivateKeySchema = z.object({
  id: z.string().min(1, "id is required"),
  name: z.string().trim().min(1, "Key name is required."),
});

const touchPrivateKeySchema = z.object({
  id: z.string().min(1, "id is required"),
  action: z.literal("touch"),
});

export async function GET() {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: "auth", message: "Unauthorized" }, 401);
    }

    return ok(await listServerEvmPrivateKeys(userId));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: "auth", message: "Unauthorized" }, 401);
    }

    const body = createPrivateKeySchema.parse(await request.json());
    return ok(await createServerEvmPrivateKey({ userId, ...body }));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: "auth", message: "Unauthorized" }, 401);
    }

    const rawBody = await request.json();
    const touchPayload = touchPrivateKeySchema.safeParse(rawBody);

    if (touchPayload.success) {
      const item = await touchServerEvmPrivateKeyLastUsed(userId, touchPayload.data.id);

      if (!item) {
        return fail({ category: "validation", message: "Private key entry not found." }, 404);
      }

      return ok(item);
    }

    const body = renamePrivateKeySchema.parse(rawBody);
    const item = await renameServerEvmPrivateKey(userId, body.id, body.name);

    if (!item) {
      return fail({ category: "validation", message: "Private key entry not found." }, 404);
    }

    return ok(item);
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireSessionUserId();

    if (!userId) {
      return fail({ category: "auth", message: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return fail({ category: "validation", message: "id is required" }, 400);
    }

    return ok(await deleteServerEvmPrivateKey(userId, id));
  } catch (error) {
    return fail(normalizeApiError(error));
  }
}
