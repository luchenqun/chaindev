import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/platform/layout/app-shell';
import { SignUpForm } from '@/platform/auth/sign-up-form';

export default async function SignUpPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl pb-10 pt-4">
        <SignUpForm />
      </main>
    </AppShell>
  );
}
