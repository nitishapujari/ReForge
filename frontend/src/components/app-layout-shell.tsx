"use client";

import React, { Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();

  React.useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.push("/login");
    } else if (status === "authenticated" && pathname === "/login") {
      router.push("/");
    }
  }, [status, pathname, router]);

  // On login screen, render full screen page content directly
  if (pathname === "/login") {
    return <div className="flex min-h-screen w-full flex-col bg-zinc-950">{children}</div>;
  }

  // Prevent showing the app shell before auth state is determined
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Suspense fallback={<div className="w-64 border-r bg-background/40 backdrop-blur-xl border-sidebar-border/50 shrink-0" />}>
        <AppSidebar />
      </Suspense>
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
