"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { Cog, Search } from "lucide-react"
import { OPEN_COMMAND_PALETTE } from "@/components/custom/command-palette"
import { NavMain } from "@/components/layout/sidebar/nav-main"
import { NavUser } from "@/components/layout/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { sidebarData } from "@/components/layout/sidebar-data"
import { APP_NAME } from "@/lib/constants"
import { useCurrentUser } from '@/lib/store'

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const currentUser = useCurrentUser()
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  
  const shouldMatchTheme = currentUser?.matchThemeWithLogo && currentUser?.colorTheme !== 'default'
  let bgColor = '#9cd0fb'
  let iconColor = '#103074'
  
  if (shouldMatchTheme) {
    bgColor = 'var(--primary)'
    iconColor = 'var(--primary)'
  }

  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <div 
        className="rounded-lg aspect-square p-1 flex items-center justify-center"
        style={{
          backgroundColor: shouldMatchTheme
        ? `color-mix(in srgb, var(--primary), ${isDarkMode ? "black 70%" : "white 80%"})`
        : bgColor,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 -960 960 960"
          fill={shouldMatchTheme ? 'var(--primary)' : iconColor}
          className={"block transition-all duration-150 mr-[2px] " + (collapsed ? "w-[38px] h-[38px]" : "h-[48px] w-[48px]")}
        >
          <path d="M242-249q-20-11-31-29.5T200-320v-192l-96-53q-11-6-16-15t-5-20q0-11 5-20t16-15l338-184q9-5 18.5-7.5T480-829q10 0 19.5 2.5T518-819l381 208q10 5 15.5 14.5T920-576v256q0 17-11.5 28.5T880-280q-17 0-28.5-11.5T840-320v-236l-80 44v192q0 23-11 41.5T718-249L518-141q-9 5-18.5 7.5T480-131q-10 0-19.5-2.5T442-141L242-249Zm238-203 274-148-274-148-274 148 274 148Zm0 241 200-108v-151l-161 89q-9 5-19 7.5t-20 2.5q-10 0-20-2.5t-19-7.5l-161-89v151l200 108Zm0-241Zm0 121Zm0 0Z" />
        </svg>
      </div>
      <span
        className={`truncate transition-all duration-150 ease-in-out font-bold text-2xl ${collapsed ? "opacity-0 w-0" : "opacity-100"
          }`}
      >
        {APP_NAME}
      </span>
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
    useCurrentUser();
    return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className={"transition-all duration-150 " + (collapsed ? "p-0" : "p-2")}>
        <SidebarBrand collapsed={collapsed} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2 pt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search (Ctrl K)"
              onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))}
              className="text-muted-foreground"
            >
              <Search />
              <span className="truncate flex-1">Search</span>
              <kbd className="text-[10px] border rounded px-1">Ctrl K</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavMain items={sidebarData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === "/settings"} tooltip="Settings">
              <Link to="/settings">
                <Cog />
                <span className="truncate">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
