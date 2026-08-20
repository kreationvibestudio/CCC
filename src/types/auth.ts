export type UserRole =
  | "super_administrator"
  | "candidate"
  | "campaign_director"
  | "director_general"
  | "media_director"
  | "social_media_team"
  | "volunteer_coordinator"
  | "ward_coordinator"
  | "polling_unit_supervisor"
  | "polling_agent"
  | "data_analyst"
  | "call_center_agent"
  | "supporter";

export type Permission =
  | "dashboard.view"
  | "social.view"
  | "social.manage"
  | "comments.view"
  | "comments.reply"
  | "comments.assign"
  | "comments.moderate"
  | "ai.use"
  | "sentiment.view"
  | "volunteers.view"
  | "volunteers.manage"
  | "crm.view"
  | "crm.manage"
  | "events.view"
  | "events.manage"
  | "polling_units.view"
  | "polling_units.manage"
  | "maps.view"
  | "maps.voter_lookup"
  | "situation_room.view"
  | "situation_room.manage"
  | "election_results.submit"
  | "agent.portal"
  | "communications.view"
  | "communications.send"
  | "analytics.view"
  | "reports.view"
  | "reports.generate"
  | "admin.users"
  | "admin.audit";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_administrator: "Super Administrator",
  candidate: "Candidate",
  campaign_director: "Campaign Director",
  director_general: "Director General",
  media_director: "Media Director",
  social_media_team: "Social Media Team",
  volunteer_coordinator: "Volunteer Coordinator",
  ward_coordinator: "Ward Coordinator",
  polling_unit_supervisor: "Polling Unit Supervisor",
  polling_agent: "Polling Agent",
  data_analyst: "Data Analyst",
  call_center_agent: "Call Center Agent",
  supporter: "Supporter",
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_administrator: [
    "dashboard.view", "social.view", "social.manage", "comments.view",
    "comments.reply", "comments.assign", "comments.moderate", "ai.use",
    "sentiment.view", "volunteers.view", "volunteers.manage", "crm.view",
    "crm.manage", "events.view", "events.manage", "polling_units.view",
    "polling_units.manage", "maps.view", "maps.voter_lookup",
    "situation_room.view", "situation_room.manage", "election_results.submit",
    "agent.portal",
    "communications.view", "communications.send", "analytics.view",
    "reports.view", "reports.generate", "admin.users", "admin.audit",
  ],
  candidate: [
    "dashboard.view", "social.view", "comments.view", "ai.use", "sentiment.view",
    "volunteers.view", "crm.view", "events.view", "polling_units.view", "maps.view",
    "situation_room.view", "analytics.view", "reports.view", "reports.generate",
  ],
  campaign_director: [
    "dashboard.view", "social.view", "social.manage", "comments.view",
    "comments.reply", "comments.assign", "ai.use", "sentiment.view",
    "volunteers.view", "volunteers.manage", "crm.view", "crm.manage",
    "events.view", "events.manage", "polling_units.view", "polling_units.manage",
    "maps.view", "situation_room.view", "situation_room.manage",
    "agent.portal",
    "communications.view", "communications.send", "analytics.view",
    "reports.view", "reports.generate",
  ],
  director_general: [
    "dashboard.view", "social.view", "comments.view", "ai.use", "sentiment.view",
    "volunteers.view", "crm.view", "events.view", "polling_units.view",
    "maps.view", "situation_room.view", "analytics.view", "reports.view",
    "reports.generate",
  ],
  media_director: [
    "dashboard.view", "social.view", "social.manage", "comments.view",
    "comments.reply", "comments.assign", "comments.moderate", "ai.use",
    "sentiment.view", "analytics.view", "reports.view", "reports.generate",
  ],
  social_media_team: [
    "dashboard.view", "social.view", "social.manage", "comments.view",
    "comments.reply", "comments.assign", "ai.use", "sentiment.view",
  ],
  volunteer_coordinator: [
    "dashboard.view", "volunteers.view", "volunteers.manage", "events.view",
    "events.manage", "communications.view", "communications.send",
  ],
  ward_coordinator: [
    "dashboard.view", "volunteers.view", "events.view", "polling_units.view",
    "maps.view", "communications.view",
  ],
  polling_unit_supervisor: [
    "dashboard.view", "polling_units.view", "polling_units.manage",
    "situation_room.view", "situation_room.manage", "maps.view",
    "election_results.submit", "agent.portal",
  ],
  polling_agent: [
    "polling_units.view", "situation_room.view", "election_results.submit",
    "maps.view", "agent.portal",
  ],
  data_analyst: [
    "dashboard.view", "social.view", "comments.view", "sentiment.view",
    "analytics.view", "reports.view", "reports.generate", "polling_units.view",
  ],
  call_center_agent: [
    "dashboard.view", "crm.view", "crm.manage", "communications.view",
    "communications.send",
  ],
  supporter: ["dashboard.view", "events.view", "maps.view"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
