"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ClipboardList,
  DatabaseBackup,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/backups", label: "النسخ الاحتياطية", icon: DatabaseBackup },
  { href: "/restore-tests", label: "اختبارات الاستعادة", icon: ShieldCheck },
  { href: "/audit", label: "سجل التدقيق", icon: ClipboardList },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function AppSidebar({ systemLabel }: { systemLabel: string }) {
  const pathname = usePathname();
  const session = useSession();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // audit failure must not block logout
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-s border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">WEPS Backup Center</p>
        <p className="mt-1 text-xs text-sidebar-foreground/70">مركز إدارة النسخ الاحتياطية لقواعد البيانات</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="التنقل الرئيسي">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/70",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3 text-xs">
        <p>حالة النظام: {systemLabel}</p>
        <p className="truncate" title={session.data?.user?.email ?? ""}>
          {session.data?.user?.email}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start cursor-pointer"
          onClick={() => void handleLogout()}
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </Button>
      </div>
    </aside>
  );
}
