export interface ModuleConfig {
  slug: string;
  title: string;
  description: string;
  features: string[];
}

export const MODULES: Record<string, ModuleConfig> = {
  social: {
    slug: "social",
    title: "Social Media Command Center",
    description: "Unified inbox across Facebook, Instagram, X, TikTok, and YouTube.",
    features: ["Platform metrics", "Post performance", "Follower growth", "Engagement rate", "Connect accounts", "Sync schedule"],
  },
  comments: {
    slug: "comments",
    title: "Unified Comment Management",
    description: "Every comment from every platform in one dashboard.",
    features: ["AI sentiment", "Issue classification", "Assign staff", "Reply inline", "Flag misinformation", "Bulk actions"],
  },
  ai: {
    slug: "ai",
    title: "AI Campaign Assistant",
    description: "AI-powered content, replies, and strategic recommendations.",
    features: ["Suggest replies", "Translate", "Summarize threads", "Detect misinformation", "Generate reports", "Speech drafts"],
  },
  sentiment: {
    slug: "sentiment",
    title: "Sentiment Intelligence",
    description: "Automatic classification and geographic sentiment analysis.",
    features: ["Positive/Neutral/Negative", "Topic heat maps", "Trend charts", "Regional comparison", "Ward breakdown", "LGA analysis"],
  },
  volunteers: {
    slug: "volunteers",
    title: "Volunteer Management",
    description: "Complete volunteer database with tasks and GPS check-in.",
    features: ["Volunteer profiles", "Task assignment", "Attendance tracking", "GPS check-in", "Performance ratings", "Messaging"],
  },
  crm: {
    slug: "crm",
    title: "Campaign CRM",
    description: "Manage supporters, leaders, donors, and influencers.",
    features: ["Contact types", "Support levels", "Donation history", "Meeting notes", "Issue tracking", "Staff assignment"],
  },
  events: {
    slug: "events",
    title: "Campaign Events",
    description: "Town halls, rallies, ward meetings, and fundraising events.",
    features: ["Event calendar", "RSVP management", "QR check-in", "Photo gallery", "Attendance reports", "Invitations"],
  },
  "polling-units": {
    slug: "polling-units",
    title: "Polling Unit Intelligence",
    description: "Complete polling unit database with assignments and risk levels.",
    features: ["PU database", "Agent assignment", "Risk assessment", "Historical results", "Security notes", "Interactive map"],
  },
  maps: {
    slug: "maps",
    title: "Voter Maps",
    description: "Google Maps integration for polling unit lookup and directions.",
    features: ["Search by ward", "Search by PU code", "Driving directions", "Walking directions", "Campaign offices", "Assistance centers"],
  },
  "situation-room": {
    slug: "situation-room",
    title: "Election Situation Room",
    description: "Live election monitoring with color-coded polling unit status.",
    features: ["Live map", "Status colors", "Incident reports", "Turnout tracking", "Result uploads", "Agent reports"],
  },
  communications: {
    slug: "communications",
    title: "Communication Center",
    description: "Termii SMS templates and CRM contact broadcasts.",
    features: ["SMS templates", "Draft campaigns", "Termii dispatch", "Audience filters (ward / support)", "Delivery logging", "Send from UI"],
  },
  analytics: {
    slug: "analytics",
    title: "Analytics",
    description: "Cross-module performance dashboards and AI insights.",
    features: ["Social analytics", "Volunteer metrics", "Geographic performance", "Donation trends", "Engagement rates", "AI insights"],
  },
  reports: {
    slug: "reports",
    title: "Reports",
    description: "Downloadable PDF and Excel campaign reports.",
    features: ["Daily report", "Weekly report", "Ward report", "LGA report", "Volunteer report", "Media performance"],
  },
  admin: {
    slug: "admin",
    title: "Administration",
    description: "User management, tenant settings, and audit logs.",
    features: ["User roles", "Permissions", "Audit logs", "Tenant settings", "Integration keys", "Backup status"],
  },
};

export function getModule(slug: string): ModuleConfig | undefined {
  return MODULES[slug];
}
