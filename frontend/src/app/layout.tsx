import type { Metadata } from "next";
import { Inter } from "next/font/google"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { UserProvider } from "@/contexts/user-context"
import { NextAuthProvider } from "@/app/providers"
import { AppLayoutShell } from "@/components/app-layout-shell"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ReForge",
  description: "Self-Healing Retrieval-Augmented Generation Pipeline",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <NextAuthProvider>
            <UserProvider>
              <TooltipProvider>
                <AppLayoutShell>
                  {children}
                </AppLayoutShell>
              </TooltipProvider>
            </UserProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
