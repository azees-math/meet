"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type SidebarContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  openMobile: boolean
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  className,
  style,
}: React.PropsWithChildren<{
  defaultOpen?: boolean
  className?: string
  style?: React.CSSProperties
}>) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [openMobile, setOpenMobile] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const onChange = () => setIsMobile(mediaQuery.matches)
    onChange()
    mediaQuery.addEventListener("change", onChange)
    return () => mediaQuery.removeEventListener("change", onChange)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value)
      return
    }
    setOpen((value) => !value)
  }, [isMobile])

  return (
    <SidebarContext.Provider
      value={{ open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }}
    >
      <div className={cn("flex min-h-screen w-full bg-zinc-950 text-zinc-50", className)} style={style}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"aside"> & {
    collapsible?: "icon" | "none"
  }
>(({ className, children, collapsible = "icon", ...props }, ref) => {
  const { open, openMobile, setOpenMobile, isMobile } = useSidebar()

  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden",
            openMobile ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setOpenMobile(false)}
        />
        <aside
          ref={ref}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-zinc-950 transition-transform md:hidden",
            openMobile ? "translate-x-0" : "-translate-x-full",
            className,
          )}
          {...props}
        >
          {children}
        </aside>
      </>
    )
  }

  return (
    <aside
      ref={ref}
      data-state={open ? "open" : "closed"}
      className={cn(
        "hidden border-r border-white/10 bg-zinc-950 transition-[width] duration-200 ease-linear md:flex md:flex-col",
        collapsible === "icon" ? (open ? "md:w-72" : "md:w-20") : "md:w-72",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  )
})
Sidebar.displayName = "Sidebar"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("border-b border-white/10 p-3", className)} {...props} />
  ),
)
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-y-auto p-3", className)} {...props} />
  ),
)
SidebarContent.displayName = "SidebarContent"

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("border-t border-white/10 p-3", className)} {...props} />
  ),
)
SidebarFooter.displayName = "SidebarFooter"

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4", className)} {...props} />
  ),
)
SidebarGroup.displayName = "SidebarGroup"

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500", className)}
      {...props}
    />
  ),
)
SidebarGroupLabel.displayName = "SidebarGroupLabel"

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1", className)} {...props} />
  ),
)
SidebarGroupContent.displayName = "SidebarGroupContent"

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("space-y-1", className)} {...props} />
  ),
)
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("list-none", className)} {...props} />,
)
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    isActive?: boolean
  }
>(({ className, isActive = false, ...props }, ref) => {
  const { open, isMobile } = useSidebar()
  return (
    <button
      ref={ref}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive ? "bg-white text-zinc-950" : "text-zinc-300 hover:bg-white/8 hover:text-white",
        !open && !isMobile ? "justify-center px-0" : "",
        className,
      )}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SidebarInset = React.forwardRef<HTMLElement, React.ComponentProps<"main">>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      className={cn("flex h-screen min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-50", className)}
      {...props}
    />
  ),
)
SidebarInset.displayName = "SidebarInset"

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()
    return (
      <Button ref={ref} variant="ghost" size="icon" className={cn("text-zinc-300 hover:text-white", className)} onClick={toggleSidebar} {...props}>
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    )
  },
)
SidebarTrigger.displayName = "SidebarTrigger"
