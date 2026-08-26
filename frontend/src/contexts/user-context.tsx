"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react"
import { useSession } from "next-auth/react"

export type ThemePreference = "light" | "dark" | "system"

export interface User {
  id: string
  email: string
  fullName: string
  avatarInitials: string
  themePreference: ThemePreference
  onboardingCompleted: boolean
  createdAt: string
}

interface UserContextType {
  user: User | null
  updateUser: (user: Partial<User>) => void
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [user, setUser] = useState<User | null>(null)
  
  // Sync the context user with the NextAuth session
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // Create initials from name or email
      const name = session.user.name || session.user.email || "User"
      const parts = name.split(" ")
      let initials = "U"
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      } else if (name.length > 0) {
        initials = name.substring(0, 2).toUpperCase()
      }

      setUser({
        id: session.user.id as string || "unknown",
        email: session.user.email || "",
        fullName: name,
        avatarInitials: initials,
        themePreference: "system", // Would normally come from DB/Preferences
        onboardingCompleted: true,
        createdAt: new Date().toISOString(), // Mocked for now, normally from DB
      })
    } else if (status === "unauthenticated") {
      setUser(null)
    }
  }, [session, status])

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }

  return (
    <UserContext.Provider value={{ user, updateUser, isLoading: status === "loading" }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
