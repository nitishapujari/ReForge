"use client"

import { useUser } from "@/contexts/user-context"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { User2, Calendar, Monitor, CheckCircle2 } from "lucide-react"

export default function ProfilePage() {
  const { user: contextUser } = useUser()
  const { data: session } = useSession()

  const fallbackUser = contextUser
  const displayName = session?.user?.name || session?.user?.email || fallbackUser?.fullName || "User"
  const displayId = session?.user?.id || fallbackUser?.id || "Unknown"
  const initials = displayName.substring(0, 2).toUpperCase()

  // Format date safely
  const joinedDate = new Date(fallbackUser?.createdAt || new Date()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal information and account details.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your basic profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 rounded-xl shadow-sm border">
                <AvatarFallback className="text-2xl rounded-xl bg-primary/5 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="font-semibold text-xl">{displayName}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <User2 className="w-4 h-4" /> User ID: <span className="font-mono text-xs">{displayId}</span>
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Joined Date
                </p>
                <p className="text-base font-medium">{joinedDate}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Theme Preference
                </p>
                <p className="text-base font-medium capitalize">{fallbackUser?.themePreference || "system"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Onboarding Status
                </p>
                <p className="text-base font-medium">
                  {fallbackUser?.onboardingCompleted ? "Completed" : "Pending"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
