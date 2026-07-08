"use client"

import * as React from "react"
import { MessageSquare, Library, Upload, Settings, Activity } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// Navigation items
const navItems = [
  {
    title: "Chat",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Knowledge Base",
    url: "/knowledge",
    icon: Library,
  },
  {
    title: "Upload Documents",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Execution Trace",
    url: "/trace",
    icon: Activity,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="bg-primary text-primary-foreground p-1 rounded">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-anvil"
            >
              <path d="M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4" />
              <path d="M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7.26 7.26 0 0 1-7.26 7.26c-1.12 0-2.19-.28-3.12-.78L8.4 15.36A3.996 3.996 0 0 1 11.23 20H13a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2h1.77a4 4 0 0 1-2.83-4.64L10.26 12C9.28 11.2 8 10 7 10z" />
            </svg>
          </div>
          ReForge
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    render={<Link href={item.url} />}
                    isActive={pathname?.startsWith(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
