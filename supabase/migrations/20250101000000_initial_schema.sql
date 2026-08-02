-- Campaign Command Center - Core Schema
-- Multi-tenant with RLS

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM (
  'super_administrator', 'candidate', 'campaign_director', 'director_general',
  'media_director', 'social_media_team', 'volunteer_coordinator', 'ward_coordinator',
  'polling_unit_supervisor', 'polling_agent', 'data_analyst', 'call_center_agent', 'supporter'
);

CREATE TYPE social_platform AS ENUM ('facebook', 'instagram', 'x', 'tiktok', 'youtube');
CREATE TYPE sentiment_category AS ENUM ('positive', 'neutral', 'negative');
CREATE TYPE issue_topic AS ENUM (
  'security', 'roads', 'education', 'healthcare', 'agriculture', 'economy',
  'employment', 'youth', 'women', 'electricity', 'water', 'corruption', 'infrastructure', 'other'
);
CREATE TYPE comment_status AS ENUM ('pending', 'assigned', 'replied', 'resolved', 'flagged');
CREATE TYPE contact_type AS ENUM (
  'individual', 'community_leader', 'religious_leader', 'youth_leader',
  'women_leader', 'traditional_ruler', 'donor', 'influencer', 'party_official'
);
CREATE TYPE event_type AS ENUM (
  'town_hall', 'rally', 'ward_meeting', 'door_to_door', 'fundraising_dinner', 'press_conference'
);
CREATE TYPE pu_status AS ENUM (
  'not_active', 'voting_in_progress', 'delayed', 'minor_issue', 'serious_incident', 'results_uploaded'
);
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE support_level AS ENUM ('strong', 'leaning', 'undecided', 'opposed');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error');
CREATE TYPE message_channel AS ENUM ('whatsapp', 'sms', 'email', 'push');

-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  election_date TIMESTAMPTZ,
  campaign_end_date TIMESTAMPTZ,
  fundraising_goal NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  UNIQUE(tenant_id, key)
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'supporter',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  ward TEXT,
  lga TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geography
CREATE TABLE states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE lgas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(state_id, code)
);

CREATE TABLE wards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lga_id UUID NOT NULL REFERENCES lgas(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(lga_id, code)
);

CREATE TABLE polling_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ward_id UUID REFERENCES wards(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  ward TEXT NOT NULL,
  lga TEXT NOT NULL,
  state TEXT NOT NULL,
  registered_voters INTEGER DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  assigned_agent_id UUID REFERENCES profiles(id),
  assigned_supervisor_id UUID REFERENCES profiles(id),
  risk_level risk_level DEFAULT 'low',
  security_notes TEXT,
  logistics TEXT,
  contact_phone TEXT,
  historical_results JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- Social media
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  account_name TEXT NOT NULL,
  account_id TEXT,
  access_token_encrypted TEXT,
  is_connected BOOLEAN DEFAULT FALSE,
  followers INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  platform_post_id TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  platform_comment_id TEXT NOT NULL,
  post_id UUID REFERENCES social_posts(id),
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  sentiment sentiment_category,
  issue_topic issue_topic,
  priority_score INTEGER DEFAULT 0,
  assigned_to UUID REFERENCES profiles(id),
  status comment_status DEFAULT 'pending',
  ward TEXT,
  lga TEXT,
  location TEXT,
  is_misinformation BOOLEAN DEFAULT FALSE,
  is_abusive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  platform_response_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comment_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_briefings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, briefing_date)
);

CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  suggestion_type TEXT NOT NULL,
  prompt TEXT,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Volunteers
CREATE TABLE volunteers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  ward TEXT,
  lga TEXT,
  polling_unit TEXT,
  skills TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  availability TEXT,
  training_status TEXT DEFAULT 'pending',
  supervisor_id UUID REFERENCES profiles(id),
  performance_rating NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE volunteer_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  assigned_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE volunteer_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  event_id UUID,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE volunteer_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  contact_type contact_type NOT NULL DEFAULT 'individual',
  phone TEXT,
  email TEXT,
  address TEXT,
  ward TEXT,
  lga TEXT,
  support_level support_level DEFAULT 'undecided',
  interests TEXT[] DEFAULT '{}',
  issues_raised TEXT[] DEFAULT '{}',
  assigned_staff_id UUID REFERENCES profiles(id),
  total_donations NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES profiles(id),
  interaction_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'NGN',
  payment_method TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE campaign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type event_type NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  ward TEXT,
  lga TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  max_attendees INTEGER,
  qr_code TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES campaign_events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  volunteer_id UUID REFERENCES volunteers(id),
  name TEXT NOT NULL,
  phone TEXT,
  rsvp_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES campaign_events(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES event_attendees(id),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'qr'
);

CREATE TABLE event_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES campaign_events(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Election
CREATE TABLE polling_unit_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID NOT NULL REFERENCES polling_units(id) ON DELETE CASCADE,
  status pu_status DEFAULT 'not_active',
  turnout INTEGER DEFAULT 0,
  notes TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, polling_unit_id)
);

CREATE TABLE incident_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID REFERENCES polling_units(id),
  reporter_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity risk_level DEFAULT 'medium',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_emergency BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incident_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE election_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID NOT NULL REFERENCES polling_units(id),
  submitted_by UUID REFERENCES profiles(id),
  party_votes JSONB NOT NULL DEFAULT '{}',
  total_votes INTEGER DEFAULT 0,
  result_sheet_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  polling_unit_id UUID REFERENCES polling_units(id),
  agent_id UUID REFERENCES profiles(id),
  report_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communications
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel message_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel message_channel NOT NULL,
  template_id UUID REFERENCES message_templates(id),
  audience_filter JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  sent_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES message_campaigns(id),
  recipient_phone TEXT,
  recipient_email TEXT,
  channel message_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity feed
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_comments_tenant ON comments(tenant_id);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_sentiment ON comments(sentiment);
CREATE INDEX idx_volunteers_tenant ON volunteers(tenant_id);
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_polling_units_tenant ON polling_units(tenant_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_activities_tenant ON activities(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper: get user's tenant (public schema — required for Supabase Cloud)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_unit_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Tenant policies (users see own tenant)
CREATE POLICY tenant_select ON tenants FOR SELECT USING (id = public.current_tenant_id());
CREATE POLICY profiles_select ON profiles FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

-- Generic tenant isolation policies
CREATE POLICY tenant_isolation_polling_units ON polling_units FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_social_accounts ON social_accounts FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_social_posts ON social_posts FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_comments ON comments FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_volunteers ON volunteers FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_contacts ON contacts FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_donations ON donations FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_events ON campaign_events FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_pu_status ON polling_unit_status FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_incidents ON incident_reports FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_results ON election_results FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_notifications ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY tenant_isolation_activities ON activities FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_ai_briefings ON ai_briefings FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_message_templates ON message_templates FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_isolation_message_campaigns ON message_campaigns FOR ALL USING (tenant_id = public.current_tenant_id());

-- Comment responses via comment tenant
CREATE POLICY comment_responses_access ON comment_responses FOR ALL
  USING (EXISTS (SELECT 1 FROM comments c WHERE c.id = comment_id AND c.tenant_id = public.current_tenant_id()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE polling_unit_status;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE election_results;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Auto-create profile on signup (public schema — works on Supabase Cloud)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, (SELECT id FROM public.tenants LIMIT 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'supporter')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
