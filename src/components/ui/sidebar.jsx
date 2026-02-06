import * as React from "react"
import { cn } from "@/lib/utils"
const Sidebar = React.forwardRef(({ className, ...props }, ref) => (<aside ref={ref} className={cn("flex h-full w-64 flex-col border-r bg-sidebar", className)} {...props} />))
Sidebar.displayName = "Sidebar"
const SidebarHeader = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex flex-col gap-2 p-4", className)} {...props} />))
SidebarHeader.displayName = "SidebarHeader"
const SidebarContent = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex-1 overflow-auto p-4", className)} {...props} />))
SidebarContent.displayName = "SidebarContent"
const SidebarFooter = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex flex-col gap-2 p-4", className)} {...props} />))
SidebarFooter.displayName = "SidebarFooter"
export { Sidebar, SidebarHeader, SidebarContent, SidebarFooter }
