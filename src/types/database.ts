export type SocialPlatform = "facebook" | "instagram" | "x" | "tiktok" | "youtube";

export type SentimentCategory = "positive" | "neutral" | "negative";

export type IssueTopic =
  | "security"
  | "roads"
  | "education"
  | "healthcare"
  | "agriculture"
  | "economy"
  | "employment"
  | "youth"
  | "women"
  | "electricity"
  | "water"
  | "corruption"
  | "infrastructure"
  | "other";

export type CommentStatus = "pending" | "assigned" | "replied" | "resolved" | "flagged";

export type ContactType =
  | "individual"
  | "community_leader"
  | "religious_leader"
  | "youth_leader"
  | "women_leader"
  | "traditional_ruler"
  | "donor"
  | "influencer"
  | "party_official";

export type EventType =
  | "town_hall"
  | "rally"
  | "ward_meeting"
  | "door_to_door"
  | "fundraising_dinner"
  | "press_conference";

export type PollingUnitStatus =
  | "not_active"
  | "voting_in_progress"
  | "delayed"
  | "minor_issue"
  | "serious_incident"
  | "results_uploaded";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type SupportLevel = "strong" | "leaning" | "undecided" | "opposed";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  election_date?: string;
  campaign_end_date?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  role: import("./auth").UserRole;
  mfa_enabled: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  tenant_id: string;
  platform: SocialPlatform;
  platform_comment_id: string;
  post_id?: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  sentiment?: SentimentCategory;
  issue_topic?: IssueTopic;
  priority_score: number;
  assigned_to?: string;
  status: CommentStatus;
  ward?: string;
  lga?: string;
  location?: string;
  is_misinformation: boolean;
  is_abusive: boolean;
  created_at: string;
}

export interface Volunteer {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  ward?: string;
  lga?: string;
  polling_unit?: string;
  skills: string[];
  languages: string[];
  availability?: string;
  training_status: "pending" | "in_progress" | "completed";
  supervisor_id?: string;
  performance_rating?: number;
  created_at: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  full_name: string;
  contact_type: ContactType;
  phone?: string;
  email?: string;
  ward?: string;
  lga?: string;
  support_level: SupportLevel;
  assigned_staff_id?: string;
  total_donations: number;
  created_at: string;
}

export interface CampaignEvent {
  id: string;
  tenant_id: string;
  title: string;
  event_type: EventType;
  description?: string;
  location: string;
  ward?: string;
  lga?: string;
  starts_at: string;
  ends_at?: string;
  max_attendees?: number;
  qr_code?: string;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: "whatsapp" | "sms" | "email" | "push";
  subject?: string;
  body: string;
  created_at: string;
}

export interface MessageCampaign {
  id: string;
  tenant_id: string;
  name: string;
  channel: "whatsapp" | "sms" | "email" | "push";
  template_id?: string | null;
  status: string;
  sent_count?: number;
  created_at: string;
}

export interface PollingUnit {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  registered_voters: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  assigned_agent_id?: string;
  assigned_supervisor_id?: string;
  risk_level: RiskLevel;
  security_notes?: string;
  logistics?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  read: boolean;
  link?: string;
  created_at: string;
}

export interface DashboardKPIs {
  total_supporters: number;
  total_volunteers: number;
  registered_coordinators: number;
  polling_units_covered: number;
  campaign_events: number;
  social_engagement: number;
  daily_reach: number;
  total_donations: number;
  fundraising_goal: number;
  daily_sentiment_score: number;
  voter_contacts_today: number;
  voter_contacts_total: number;
}
