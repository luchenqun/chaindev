"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFormShell } from "@/platform/auth/auth-form-shell";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") ?? "/", [searchParams]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      identifier: identifier.trim(),
      password,
      redirect: false,
      callbackUrl,
    });

    if (!result || result.error) {
      setSubmitting(false);
      setError("用户名、邮箱或密码错误。");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <AuthFormShell
      title="Sign In"
      subtitle={
        <>
          没有账号？
          <Link href="/signup" className="ml-2 font-medium text-sky-600 hover:text-sky-700">
            Sign Up
          </Link>
        </>
      }
    >
      <form className="grid gap-7" onSubmit={handleSubmit}>
        <label className="grid gap-3">
          <span className="text-[15px] font-semibold text-slate-900">Username or Email</span>
          <Input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Enter your username or email"
            className="h-16 rounded-2xl px-5 text-xl placeholder:text-slate-400"
            required
          />
        </label>

        <label className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold text-slate-900">Password</span>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-16 rounded-2xl px-5 pr-14 text-xl placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <IconEyeOff className="size-6" stroke={1.8} /> : <IconEye className="size-6" stroke={1.8} />}
            </button>
          </div>
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="h-16 rounded-2xl text-[18px] font-semibold uppercase" disabled={submitting}>
          {submitting ? "Signing In..." : "Login"}
        </Button>
      </form>
    </AuthFormShell>
  );
}
