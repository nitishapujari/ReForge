"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

export type ThemePreference = "light" | "dark" | "system"

export interface User {
  id: string
  fullName: string
  avatarInitials: string
  themePreference: ThemePreference
  onboardingCompleted: boolean
  createdAt: string
}

interface UserContextType {
  user: User | null
  updateUser: (user: Partial<User>) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const DEFAULT_USER: User = {
  id: "u_default_123",
  fullName: "Nitisha Pujari",
  avatarInitials: "NP",
  themePreference: "system",
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEFAULT_USER)

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }

  return (
    <UserContext.Provider value={{ user, updateUser }}>
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
