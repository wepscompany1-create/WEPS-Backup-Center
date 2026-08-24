"use client";

import { useTheme } from "next-themes";
import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { StatusBadge } from "@/components/status-badge";

export function AppHeader({
  sourceConnected,
  systemLabel,
}: {
  sourceConnected: boolean;
  systemLabel: string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="cursor-pointer lg:hidden" aria-label="فتح القائمة">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0">
            <SheetTitle className="sr-only">القائمة</SheetTitle>
            <AppSidebar systemLabel={systemLabel} />
          </SheetContent>
        </Sheet>
        <div>
          <p className="text-sm font-semibold">WEPS Backup Center</p>
          <p className="hidden text-xs text-muted-foreground sm:block">مركز إدارة النسخ الاحتياطية لقواعد البيانات</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge value={sourceConnected ? "CONNECTED" : "OFFLINE"} />
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          aria-label="تبديل المظهر"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </div>
    </header>
  );
}
