import type { Permission } from "@/types/auth";
import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Bot,
  TrendingUp,
  Users,
  Contact,
  Calendar,
  MapPin,
  Map,
  Radio,
  Send,
  BarChart3,
  FileText,
  Shield,
  UserCheck,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Executive Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { title: "Social Media", href: "/social", icon: MessageSquare, permission: "social.view" },
  { title: "Comments", href: "/comments", icon: MessagesSquare, permission: "comments.view", badge: "Live" },
  { title: "AI Assistant", href: "/ai", icon: Bot, permission: "ai.use" },
  { title: "Sentiment", href: "/sentiment", icon: TrendingUp, permission: "sentiment.view" },
  { title: "Volunteers", href: "/volunteers", icon: Users, permission: "volunteers.view" },
  { title: "Campaign CRM", href: "/crm", icon: Contact, permission: "crm.view" },
  { title: "Events", href: "/events", icon: Calendar, permission: "events.view" },
  { title: "Polling Units", href: "/polling-units", icon: MapPin, permission: "polling_units.view" },
  { title: "PU Agents", href: "/polling-units/agents", icon: UserCheck, permission: "polling_units.manage" },
  { title: "Voter Maps", href: "/maps", icon: Map, permission: "maps.view" },
  { title: "Situation Room", href: "/situation-room", icon: Radio, permission: "situation_room.view", badge: "Live" },
  { title: "Agent Portal", href: "/agent", icon: MapPin, permission: "agent.portal" },
  { title: "Communications", href: "/communications", icon: Send, permission: "communications.view" },
  { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
  { title: "Reports", href: "/reports", icon: FileText, permission: "reports.view" },
  { title: "Admin", href: "/admin", icon: Shield, permission: "admin.users" },
];

export const QUICK_ACTIONS = [
  { title: "New Event", href: "/events/new", permission: "events.manage" as Permission },
  { title: "Send Broadcast", href: "/communications/campaigns/new", permission: "communications.send" as Permission },
  { title: "Add Volunteer", href: "/volunteers/new", permission: "volunteers.manage" as Permission },
  { title: "Generate Report", href: "/reports", permission: "reports.generate" as Permission },
];
