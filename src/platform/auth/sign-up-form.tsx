'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AuthFormShell } from '@/platform/auth/auth-form-shell';
import { resolveAbsoluteCallbackUrl, resolveClientRedirectUrl } from '@/platform/auth/callback-url';

type RegisterResponse = { ok: true; data: { userId: string } } | { ok: false; error: { category: string; message: string } };

export function SignUpForm() {
  const messages = useMessages();
  const { locale } = useLocale();
  const loginMessages = messages.login;
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
      setError(loginMessages.passwordMismatch);
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
      setError(result.ok ? loginMessages.signUpFailed : result.error.message);
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
      setError(loginMessages.autoSignInFailed);
      return;
    }

    router.push(resolveClientRedirectUrl(signInResult.url, resolveAbsoluteCallbackUrl('/')));
    router.refresh();
  }

  return (
    <AuthFormShell
      title={loginMessages.signUpTitle}
      subtitle={
        <>
          {loginMessages.signUpSubtitlePrefix}
          <Link href="/login" className="ml-2 font-medium text-sky-600 hover:text-sky-700">
            {loginMessages.signInHereLink}
          </Link>
        </>
      }
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">{loginMessages.username}</span>
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={loginMessages.usernamePlaceholder}
            className="h-14 rounded-2xl px-4 text-lg placeholder:text-slate-400"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">{loginMessages.email}</span>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={loginMessages.emailPlaceholder}
            className="h-14 rounded-2xl px-4 text-lg placeholder:text-slate-400"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">{loginMessages.password}</span>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={loginMessages.passwordPlaceholder}
              className="h-14 rounded-2xl px-4 pr-14 text-lg placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? loginMessages.hidePassword : loginMessages.showPassword}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <IconEyeOff className="size-5" stroke={1.8} /> : <IconEye className="size-5" stroke={1.8} />}
            </button>
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-[15px] font-semibold text-slate-900">{loginMessages.confirmPassword}</span>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={loginMessages.confirmPasswordPlaceholder}
              className="h-14 rounded-2xl px-4 pr-14 text-lg placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? loginMessages.hidePassword : loginMessages.showPassword}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              onClick={() => setShowConfirmPassword((current) => !current)}
            >
              {showConfirmPassword ? <IconEyeOff className="size-5" stroke={1.8} /> : <IconEye className="size-5" stroke={1.8} />}
            </button>
          </div>
        </label>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{translateRuntimeText(error, locale)}</div> : null}

        <Button type="submit" className="mt-2 h-14 rounded-2xl text-[18px] font-semibold" disabled={submitting}>
          {submitting ? loginMessages.signUpSubmitting : loginMessages.signUpButton}
        </Button>
      </form>
    </AuthFormShell>
  );
}
