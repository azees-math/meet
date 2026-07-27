"use client"

import Link from "next/link"
import { Activity, ArrowLeft, DoorOpen, Radio, Shield, Users } from "lucide-react"

import { AuthUser } from "@/lib/auth-session"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type AdminTab = "users" | "rooms" | "online" | "logs"

const items: Array<{ key: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "users", label: "Users", icon: Users },
  { key: "rooms", label: "Meeting Rooms", icon: DoorOpen },
  { key: "online", label: "Online Users", icon: Radio },
  { key: "logs", label: "Activity Logs", icon: Activity },
]

export function AdminSidebar({
  authUser,
  activeTab,
  onSelectTab,
}: {
  authUser: AuthUser | null
  activeTab: AdminTab
  onSelectTab: (tab: AdminTab) => void
}) {
  const { open, isMobile, setOpenMobile } = useSidebar()

  const showLabel = open || isMobile

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className={cn("flex items-center gap-3", !showLabel && "justify-center")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-zinc-950">
            <Shield className="h-5 w-5" />
          </div>
          {showLabel ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Admin Panel</div>
              <div className="truncate text-xs text-zinc-400">{authUser?.username}</div>
            </div>
          ) : null}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {showLabel ? <SidebarGroupLabel>Management</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={activeTab === item.key}
                      onClick={() => {
                        onSelectTab(item.key)
                        setOpenMobile(false)
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {showLabel ? <span>{item.label}</span> : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="space-y-3">
          {showLabel ? (
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
              <div className="font-medium text-white">{authUser?.userType}</div>
              <div className="mt-1 text-zinc-400">Authorized admin session</div>
            </div>
          ) : null}
          <Button variant="outline" className={cn("w-full", !showLabel && "px-0")} asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {showLabel ? <span>Back to Meeting</span> : null}
            </Link>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
