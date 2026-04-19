'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthFormShell } from '@/platform/auth/auth-form-shell';
import { resolveAbsoluteCallbackUrl } from '@/platform/auth/callback-url';

type RegisterResponse =
  | { ok: true; data: { userId: string } }
  | { ok: false; error: { category: string; message: string } };

export function SignUpForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致。');
      return;
    }

    setSubmitting(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });

    const result = (await response.json()) as RegisterResponse;

    if (!response.ok || !result.ok) {
      setSubmitting(false);
      setError(result.ok ? '注册失败。' : result.error.message);
      return;
    }

    const signInResult = await signIn('credentials', {
      identifier: email.trim(),
      password,
      redirect: false,
      callbackUrl: resolveAbsoluteCallbackUrl('/'),
    });

    if (!signInResult || signInResult.error) {
      setSubmitting(false);
      setError('注册成功，但自动登录失败，请返回登录页手动登录。');
      return;
    }

    router.push(signInResult.url ?? resolveAbsoluteCallbackUrl('/'));
    router.refresh();
  }

  return (
    <AuthFormShell
      title="Sign Up"
      subtitle={
        <>
          已有账号？
          <Link
            href="/login"
            className="ml-2 font-medium text-sky-600 hover:text-sky-700"
          >
            Sign In here
          </Link>
        </>
      }
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">
            Username
          </span>
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            className="h-14 rounded-2xl px-4 text-lg placeholder:text-slate-400"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">
            Email Address
          </span>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="A confirmation code will be sent to this address"
            className="h-14 rounded-2xl px-4 text-lg placeholder:text-slate-400"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">
            Password
          </span>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-14 rounded-2xl px-4 pr-14 text-lg placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <IconEyeOff className="size-5" stroke={1.8} />
              ) : (
                <IconEye className="size-5" stroke={1.8} />
              )}
            </button>
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">
            Confirm Password
          </span>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              className="h-14 rounded-2xl px-4 pr-14 text-lg placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              aria-label={
                showConfirmPassword ? 'Hide password' : 'Show password'
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              onClick={() => setShowConfirmPassword((current) => !current)}
            >
              {showConfirmPassword ? (
                <IconEyeOff className="size-5" stroke={1.8} />
              ) : (
                <IconEye className="size-5" stroke={1.8} />
              )}
            </button>
          </div>
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          className="mt-2 h-14 rounded-2xl text-[18px] font-semibold"
          disabled={submitting}
        >
          {submitting ? 'Creating Account...' : 'Create an Account'}
        </Button>
      </form>
    </AuthFormShell>
  );
}
