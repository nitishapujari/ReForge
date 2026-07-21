"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // On login screen, render full screen page content directly
  if (pathname === "/login") {
    return <div className="flex min-h-screen w-full flex-col bg-zinc-950">{children}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col bg-background w-full">
        <div className="flex h-12 items-center border-b px-4 shrink-0">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
