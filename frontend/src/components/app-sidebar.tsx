"use client"

import * as React from "react"
import { MessageSquare, Library, Upload, Settings, Activity, ChevronsUpDown, User2, Monitor, Sun, Moon, Info, Plus, MoreHorizontal, Edit, Trash2, Check, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Logo } from "@/components/logo"
import { useUser } from "@/contexts/user-context"
import { useSession, signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuAction,
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
    title: "Documents",
    url: "/knowledge",
    icon: Library,
  },
  {
    title: "Upload Documents",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Verification Log",
    url: "/trace",
    icon: Activity,
  }
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeSessionId = searchParams.get('session')
  const { user } = useUser()
  
  const displayEmail = user?.email || "No email"
  const displayName = user?.fullName || "User"
  const displayInitials = user?.avatarInitials || "U"
  const [chatSessions, setChatSessions] = React.useState<any[]>([])
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")

  React.useEffect(() => {
    const fetchHistory = () => {
      fetch("/api/v1/history")
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data)) {
            setChatSessions(data)
          }
        })
        .catch(err => console.error(err))
    }
    
    fetchHistory()
    
    window.addEventListener("session-created", fetchHistory)
    return () => window.removeEventListener("session-created", fetchHistory)
  }, [pathname, activeSessionId])

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/v1/history/${id}`, { method: 'DELETE' })
      setChatSessions(prev => prev.filter(s => s.id !== id))
      if (pathname === `/chat` && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('session') === id) {
        router.push('/chat')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleRenameSession = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingSessionId(null)
      return
    }
    try {
      await fetch(`/api/v1/history/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() })
      })
      setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s))
      setEditingSessionId(null)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Sidebar {...props} className="bg-background/40 backdrop-blur-xl border-r shadow-lg border-sidebar-border/50">
      <SidebarHeader className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity mb-6">
          <div className="flex items-center justify-center w-8 h-8 shrink-0">
            <Logo />
          </div>
          ReForge
        </Link>
        <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
          <Link href="/chat" onClick={() => window.dispatchEvent(new Event("new-chat-clicked"))} className="group flex items-center gap-2 w-full px-3 py-2 text-sm font-medium transition-all duration-300 border rounded-md shadow-sm border-border bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30 hover:shadow-[0_0_10px_rgba(var(--primary),0.1)] text-foreground">
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            New Chat
          </Link>
        </motion.div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname?.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={() => {
                        if (item.url === '/chat') {
                          window.dispatchEvent(new Event("new-chat-clicked"))
                        }
                        router.push(item.url)
                      }}
                      isActive={isActive}
                      className={`relative overflow-hidden z-0 group transition-all duration-300 hover:bg-muted/50 rounded-md ${isActive ? 'text-primary font-semibold' : 'hover:text-foreground text-muted-foreground'}`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 bg-primary/10 rounded-md -z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-foreground'}`} />
                      <span className="font-medium">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup className="pt-4">
          <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatSessions.length === 0 ? (
                <div className="px-4 py-2 text-xs text-muted-foreground">No recent chats</div>
              ) : (
                chatSessions.slice(0, 10).map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    {editingSessionId === chat.id ? (
                      <div className="flex items-center gap-1 w-full px-2 py-1.5" onClick={(e) => e.preventDefault()}>
                        <input 
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSession(chat.id)
                            if (e.key === 'Escape') setEditingSessionId(null)
                          }}
                          className="flex-1 bg-background border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                          autoFocus
                        />
                        <button onClick={(e) => { e.preventDefault(); handleRenameSession(chat.id) }} className="p-0.5 text-green-500 hover:bg-green-500/10 rounded">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.preventDefault(); setEditingSessionId(null) }} className="p-0.5 text-muted-foreground hover:bg-muted rounded">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <SidebarMenuButton 
                          onClick={() => {
                            if (editingSessionId !== chat.id) router.push(`/chat?session=${chat.id}`)
                          }}
                          isActive={pathname === '/chat' && activeSessionId === chat.id}
                          className="group/chat transition-all duration-300 hover:bg-muted/50 rounded-md"
                        >
                          <span className="truncate pr-4 flex-1 text-sm group-hover/chat:text-foreground transition-colors duration-300">
                            {chat.title || "New Chat"}
                          </span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<SidebarMenuAction showOnHover />} onClick={(e) => e.preventDefault()} className="hover:bg-muted rounded-md transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                            <span className="sr-only">More</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32 z-50">
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              setEditTitle(chat.title || "New Chat")
                              setEditingSessionId(chat.id)
                            }}>
                              <Edit className="w-4 h-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.preventDefault();
                              handleDeleteSession(chat.id)
                            }} className="text-red-500 focus:text-red-500">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger 
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{displayInitials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs">{displayEmail}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg">{displayInitials}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{displayName}</span>
                        <span className="truncate text-xs">{displayEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User2 className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/system-configuration")}>
                  <Settings className="mr-2 h-4 w-4" />
                  System Configuration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/appearance")}>
                  <Monitor className="mr-2 h-4 w-4" />
                  Appearance
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/about")}>
                  <Info className="mr-2 h-4 w-4" />
                  About ReForge
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 w-full text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
