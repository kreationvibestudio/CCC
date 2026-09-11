import type { Permission } from "@/types/auth";
import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Bot,
  TrendingUp,
  Users,
  Contact,
  CircleDollarSign,
  Calendar,
  MapPin,
  Map,
  Radio,
  Send,
  BarChart3,
  FileText,
  Shield,
  UserCheck,
  GraduationCap,
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
  { title: "Training Management", href: "/training", icon: GraduationCap, permission: "training.view" },
  { title: "Campaign CRM", href: "/crm", icon: Contact, permission: "crm.view" },
  { title: "Donations", href: "/donations", icon: CircleDollarSign, permission: "donations.view" },
  { title: "Events", href: "/events", icon: Calendar, permission: "events.view" },
  { title: "Polling Units", href: "/polling-units", icon: MapPin, permission: "polling_units.view" },
  { title: "PU Agents", href: "/polling-units/agents", icon: UserCheck, permission: "polling_units.manage" },
  { title: "Field Status Map", href: "/maps", icon: Map, permission: "maps.view" },
  { title: "Situation Room", href: "/situation-room", icon: Radio, permission: "situation_room.view", badge: "Live" },
  { title: "Agent Portal", href: "/agent", icon: MapPin, permission: "agent.portal" },
  { title: "Communications", href: "/communications", icon: Send, permission: "communications.view" },
  { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
  { title: "Reports", href: "/reports", icon: FileText, permission: "reports.view" },
  { title: "Admin", href: "/admin", icon: Shield, permission: "admin.users" },
];

export const QUICK_ACTIONS = [
  { title: "Issue PU codes", href: "/polling-units/agents", permission: "polling_units.manage" as Permission, creates: true },
  { title: "New Event", href: "/events/new", permission: "events.manage" as Permission, creates: true },
  { title: "Send Broadcast", href: "/communications/campaigns/new", permission: "communications.send" as Permission, creates: true },
  { title: "Add Volunteer", href: "/volunteers/new", permission: "volunteers.manage" as Permission, creates: true },
  { title: "Donations", href: "/donations", permission: "donations.view" as Permission, creates: false },
  { title: "Training Management", href: "/training", permission: "training.view" as Permission, creates: false },
  { title: "Generate Report", href: "/reports", permission: "reports.generate" as Permission, creates: false },
];
