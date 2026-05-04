import { z } from 'zod';
import { createCredentialUser, findAuthUserConflict } from '@/server/repositories/auth-users';
import { seedDefaultWorkbenchForUser } from '@/server/repositories/workbench-bootstrap';
import { fail, ok } from '@/server/utils/api-response';

const registerSchema = z.object({
  username: z.string().trim().min(2, 'Username must be at least 2 characters.').max(40, 'Username must be 40 characters or fewer.'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128, 'Password must be 128 characters or fewer.'),
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

    if (existing?.email?.toLowerCase() === body.email || existing?.username?.toLowerCase() === body.email) {
      return fail({ category: 'validation', message: 'That email is already registered.' }, 409);
    }

    if (existing?.username?.toLowerCase() === normalizedUsernameLower || existing?.email?.toLowerCase() === normalizedUsernameLower) {
      return fail({ category: 'validation', message: 'That username already exists.' }, 409);
    }

    const user = await createCredentialUser({
      ...body,
      username: normalizedUsername,
    });

    if (!user) {
      return fail({ category: 'server', message: 'Registration failed. Please try again later.' }, 500);
    }

    await seedDefaultWorkbenchForUser(user.id);

    return ok({ userId: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        {
          category: 'validation',
          message: error.issues[0]?.message ?? 'Invalid request parameters.',
        },
        400,
      );
    }

    return fail(
      {
        category: 'server',
        message: error instanceof Error ? error.message : 'Registration failed.',
      },
      500,
    );
  }
}
