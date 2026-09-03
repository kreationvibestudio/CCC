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
    description: "Facebook page sync, post performance, and comment intake.",
    features: ["Facebook metrics", "Post performance", "Follower count", "Engagement rate", "Page token", "Daily sync"],
  },
  comments: {
    slug: "comments",
    title: "Unified Comment Management",
    description: "Facebook comments in one inbox.",
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
    features: ["Contact types", "Support levels", "Donation history", "Public Paystack donate page", "Meeting notes", "Staff assignment"],
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
    description: "Live field-status map of polling units — Voting, finished, delayed, issues, incidents, results.",
    features: [
      "Status filter chips",
      "Voting / finished / delayed",
      "Minor issue & incident",
      "Results uploaded",
      "Live status updates",
      "PU search & directions",
    ],
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
    description: "Election decision board — preventive calls from sentiment, coverage, and ground-game gaps.",
    features: [
      "Calls to make now",
      "Misinfo & comment backlog",
      "PU coverage gaps",
      "Hot issues & ward pressure",
      "Volunteer readiness",
      "Sentiment trajectory",
    ],
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
