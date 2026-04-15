import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/platform/layout/app-shell';
import { SignInForm } from '@/platform/auth/sign-in-form';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl pb-10 pt-4">
        <SignInForm />
      </main>
    </AppShell>
  );
}
