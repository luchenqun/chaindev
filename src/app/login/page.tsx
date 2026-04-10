import { IconBrandGithub, IconMailBolt, IconStack2, IconStar, IconTimeline } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMessages } from "@/i18n";
import { AppShell } from "@/platform/layout/app-shell";

const savedItems = [
  { label: "RPC Profiles", icon: IconStack2 },
  { label: "Request History", icon: IconTimeline },
  { label: "Transaction Drafts", icon: IconMailBolt },
  { label: "Favorites", icon: IconStar },
];

export default function LoginPage() {
  const messages = getMessages();
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl pb-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <span className="mb-1 inline-block text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600">
              Authentication
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign In To Workbench</h1>
          </div>
          <p className="max-w-md text-right text-sm text-slate-500">
            Save RPC profiles, request history, tx drafts, decode records and favorites.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardContent className="p-6">
              <Badge className="mb-3">Available Methods</Badge>
              <h2 className="mb-2 text-xl font-semibold text-slate-900">{messages.login.chooseMethod}</h2>
              <p className="mb-5 text-sm leading-6 text-slate-500">{messages.login.chooseMethodDescription}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                    <IconBrandGithub className="size-5" stroke={2} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">GitHub</h3>
                  <p className="text-sm leading-6 text-slate-500">{messages.login.githubDescription}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                    <IconMailBolt className="size-5" stroke={2} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">Email Magic Link</h3>
                  <p className="text-sm leading-6 text-slate-500">{messages.login.emailDescription}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Badge variant="secondary" className="mb-3">
                Workspace Storage
              </Badge>
              <h2 className="mb-4 text-xl font-semibold text-slate-900">{messages.login.workspaceStorageTitle}</h2>
              <div className="grid gap-3">
                {savedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex size-10 items-center justify-center rounded-lg bg-white text-sky-600 shadow-sm">
                        <Icon className="size-5" stroke={2} />
                      </div>
                      <div className="text-sm font-medium text-slate-700">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
