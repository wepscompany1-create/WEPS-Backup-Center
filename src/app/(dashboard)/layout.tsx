import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { getSourceHealth } from "@/lib/postgres/source";
import { anyHeavyJobRunning } from "@/lib/db/locks";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [source, jobs] = await Promise.all([getSourceHealth(), anyHeavyJobRunning()]);
  const systemLabel = jobs.busy ? "عملية قيد التنفيذ" : source.connected ? "جاهز" : "المصدر غير متصل";

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <AppSidebar systemLabel={systemLabel} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader sourceConnected={source.connected} systemLabel={systemLabel} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
