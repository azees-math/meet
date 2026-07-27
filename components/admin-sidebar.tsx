"use client"

import Link from "next/link"
import * as React from "react"
import { Activity, ArrowLeft, ChevronUp, DoorOpen, LogOut, Radio, Shield, User, Users } from "lucide-react"

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
  onSignOut,
}: {
  authUser: AuthUser | null
  activeTab: AdminTab
  onSelectTab: (tab: AdminTab) => void
  onSignOut: () => void
}) {
  const { open, isMobile, setOpenMobile } = useSidebar()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  const showLabel = open || isMobile
  const displayName =
    [authUser?.first_name, authUser?.last_name].filter(Boolean).join(" ") || authUser?.username || "Admin"
  const avatarLabel = (authUser?.first_name?.[0] ?? authUser?.username?.[0] ?? "A").toUpperCase()

  React.useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
    }
  }, [menuOpen])

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
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10",
                !showLabel && "justify-center px-2",
              )}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {authUser?.picture ? (
                <img
                  src={authUser.picture}
                  alt={displayName}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-950">
                  {avatarLabel}
                </div>
              )}
              {showLabel ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{displayName}</div>
                    <div className="truncate text-xs text-zinc-400">
                      {authUser?.username} • {authUser?.userType}
                    </div>
                  </div>
                  <ChevronUp className={cn("h-4 w-4 text-zinc-400 transition-transform", menuOpen && "rotate-180")} />
                </>
              ) : null}
            </button>

            {menuOpen ? (
              <div
                className={cn(
                  "absolute bottom-full left-0 z-50 mb-2 min-w-[220px] rounded-md border border-white/10 bg-zinc-900 p-1 shadow-2xl",
                  !showLabel && "left-full ml-2 w-56",
                )}
              >
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setMenuOpen(false)
                    setOpenMobile(false)
                  }}
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/15 hover:text-red-100"
                  onClick={() => {
                    setMenuOpen(false)
                    setOpenMobile(false)
                    onSignOut()
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : null}
          </div>
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
