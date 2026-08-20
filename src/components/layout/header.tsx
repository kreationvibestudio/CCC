"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search, Bell, Sun, Moon, Plus, LogOut, User, Settings, Command, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MobileSidebarTrigger } from "@/components/layout/sidebar";
import { NAV_ITEMS, QUICK_ACTIONS } from "@/lib/navigation";
import { useAuth, usePermissions } from "@/components/providers/auth-provider";
import { useNotifications } from "@/hooks/use-realtime";
import { signOut } from "@/lib/auth/actions";
import { getInitials } from "@/lib/utils";
import { ROLE_LABELS } from "@/types/auth";

export function Header() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = useAuth();
  const { can } = usePermissions();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { notifications, unreadCount } = useNotifications(user?.id);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const searchableItems = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-card/50 px-4 backdrop-blur-sm">
      <MobileSidebarTrigger />

      <div className="relative hidden flex-1 max-w-md sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search everywhere... (⌘K)"
          className="pl-9 cursor-pointer"
          onClick={() => setSearchOpen(true)}
          readOnly
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchOpen(true)}>
          <Search className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {QUICK_ACTIONS.filter((a) => can(a.permission)).map((action) => (
              <DropdownMenuItem key={action.href} onClick={() => router.push(action.href)}>
                {action.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-64">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3">
                    <span className="font-medium text-sm">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.message}</span>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profile.avatar_url} />
                <AvatarFallback>{getInitials(user?.profile.full_name ?? "U")}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.profile.full_name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user ? ROLE_LABELS[user.role] : ""}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings/security")}>
              <Settings className="mr-2 h-4 w-4" /> Security & 2FA
            </DropdownMenuItem>
            {user?.isPlatformOperator && (
              <DropdownMenuItem onClick={() => router.push("/platform")}>
                <Shield className="mr-2 h-4 w-4" /> Platform
              </DropdownMenuItem>
            )}
            {can("admin.users") && (
              <DropdownMenuItem onClick={() => router.push("/admin")}>
                <Shield className="mr-2 h-4 w-4" /> Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search modules, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Modules">
            {searchableItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => { setSearchOpen(false); router.push(item.href); }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
                {item.badge && <Badge variant="success" className="ml-auto text-[10px]">{item.badge}</Badge>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quick Actions">
            {QUICK_ACTIONS.filter((a) => can(a.permission)).map((action) => (
              <CommandItem
                key={action.href}
                onSelect={() => { setSearchOpen(false); router.push(action.href); }}
              >
                <Command className="mr-2 h-4 w-4" />
                {action.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
