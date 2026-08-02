"use client";

import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import { usePermissions } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center border-b border-border px-4", collapsed && "justify-center px-2")}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Shield className="h-6 w-6 shrink-0 text-primary" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-none">CCC</span>
              <span className="text-[10px] text-muted-foreground">Command Center</span>
            </div>
          )}
        </Link>
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge variant="success" className="text-[10px] px-1.5 py-0">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>
      </ScrollArea>
      <div className="hidden border-t border-border p-2 lg:block">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile toggle - exposed via data attribute for header */}
      <button
        data-sidebar-toggle
        className="hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      />
    </TooltipProvider>
  );
}

export function MobileSidebarTrigger() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden"
      onClick={() => document.querySelector<HTMLButtonElement>("[data-sidebar-toggle]")?.click()}
    >
      <Shield className="h-5 w-5" />
    </Button>
  );
}
