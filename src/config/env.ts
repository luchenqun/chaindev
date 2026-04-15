import { z } from 'zod';

const envSchema = z.object({
  AUTH_SECRET: z.string().min(1),
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export function readEnv() {
  return envSchema.parse({
    AUTH_SECRET: process.env.AUTH_SECRET ?? 'dev-secret',
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? 'github-id',
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET ?? 'github-secret',
    SMTP_HOST: process.env.SMTP_HOST ?? '127.0.0.1',
    SMTP_PORT: process.env.SMTP_PORT ?? '1025',
    SMTP_USER: process.env.SMTP_USER ?? 'dev@example.com',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? 'password',
    DATABASE_URL: process.env.DATABASE_URL ?? './data/chaindev.sqlite',
  });
}

export const env = readEnv();
