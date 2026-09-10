-- Role-based Volunteer LMS. Safe to re-run.

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS support_roles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS training_code TEXT,
  ADD COLUMN IF NOT EXISTS deployment_ready BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS volunteers_tenant_training_code
  ON volunteers (tenant_id, training_code)
  WHERE training_code IS NOT NULL;

ALTER TABLE campaign_events
  ADD COLUMN IF NOT EXISTS requires_trained BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS required_role_slug TEXT;

CREATE TABLE IF NOT EXISTS lms_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  role_slug TEXT,
  estimated_minutes INT DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'published',
  pass_mark INT DEFAULT 70,
  max_attempts INT DEFAULT 3,
  is_required BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS lms_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT,
  resource_url TEXT,
  estimated_minutes INT DEFAULT 5,
  sort_order INT DEFAULT 0,
  quiz JSONB,
  UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS lms_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned',
  required BOOLEAN DEFAULT TRUE,
  due_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (volunteer_id, course_id)
);

CREATE TABLE IF NOT EXISTS lms_module_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES lms_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'incomplete',
  score NUMERIC,
  attempts INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  acknowledgement TEXT,
  assignment_notes TEXT,
  UNIQUE (volunteer_id, module_id)
);

CREATE TABLE IF NOT EXISTS lms_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES lms_modules(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (volunteer_id, course_id)
);

CREATE TABLE IF NOT EXISTS lms_live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID REFERENCES lms_courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_url TEXT,
  capacity INT,
  follow_up TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_session_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES lms_live_sessions(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  UNIQUE (session_id, volunteer_id)
);

CREATE TABLE IF NOT EXISTS lms_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lms_enrollments_volunteer ON lms_enrollments (volunteer_id);
CREATE INDEX IF NOT EXISTS lms_enrollments_tenant ON lms_enrollments (tenant_id);
CREATE INDEX IF NOT EXISTS lms_progress_volunteer ON lms_module_progress (volunteer_id);
CREATE INDEX IF NOT EXISTS lms_sessions_tenant ON lms_live_sessions (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS lms_activity_tenant ON lms_activity_logs (tenant_id, created_at DESC);

ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_session_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_lms_courses ON lms_courses;
CREATE POLICY tenant_isolation_lms_courses ON lms_courses
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_modules ON lms_modules;
CREATE POLICY tenant_isolation_lms_modules ON lms_modules
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_enrollments ON lms_enrollments;
CREATE POLICY tenant_isolation_lms_enrollments ON lms_enrollments
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_progress ON lms_module_progress;
CREATE POLICY tenant_isolation_lms_progress ON lms_module_progress
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_quiz ON lms_quiz_attempts;
CREATE POLICY tenant_isolation_lms_quiz ON lms_quiz_attempts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_certs ON lms_certificates;
CREATE POLICY tenant_isolation_lms_certs ON lms_certificates
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_sessions ON lms_live_sessions;
CREATE POLICY tenant_isolation_lms_sessions ON lms_live_sessions
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_attendees ON lms_session_attendees;
CREATE POLICY tenant_isolation_lms_attendees ON lms_session_attendees
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_lms_activity ON lms_activity_logs;
CREATE POLICY tenant_isolation_lms_activity ON lms_activity_logs
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
