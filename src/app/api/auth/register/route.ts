import { z } from 'zod';
import {
  createCredentialUser,
  findAuthUserConflict,
} from '@/server/repositories/auth-users';
import { seedDefaultWorkbenchForUser } from '@/server/repositories/workbench-bootstrap';
import { fail, ok } from '@/server/utils/api-response';

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, '用户名至少 2 位。')
    .max(40, '用户名不能超过 40 位。'),
  email: z
    .string()
    .trim()
    .email('请输入有效邮箱地址。')
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, '密码至少 8 位。')
    .max(128, '密码不能超过 128 位。'),
});

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const normalizedUsername = body.username.trim();
    const normalizedUsernameLower = normalizedUsername.toLowerCase();
    const existing = await findAuthUserConflict({
      email: body.email,
      username: normalizedUsername,
    });

    if (
      existing?.email?.toLowerCase() === body.email ||
      existing?.username?.toLowerCase() === body.email
    ) {
      return fail({ category: 'validation', message: '该邮箱已注册。' }, 409);
    }

    if (
      existing?.username?.toLowerCase() === normalizedUsernameLower ||
      existing?.email?.toLowerCase() === normalizedUsernameLower
    ) {
      return fail({ category: 'validation', message: '该用户名已存在。' }, 409);
    }

    const user = await createCredentialUser({
      ...body,
      username: normalizedUsername,
    });

    if (!user) {
      return fail(
        { category: 'server', message: '注册失败，请稍后重试。' },
        500,
      );
    }

    await seedDefaultWorkbenchForUser(user.id);

    return ok({ userId: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        {
          category: 'validation',
          message: error.issues[0]?.message ?? '参数不合法。',
        },
        400,
      );
    }

    return fail(
      {
        category: 'server',
        message: error instanceof Error ? error.message : '注册失败。',
      },
      500,
    );
  }
}
