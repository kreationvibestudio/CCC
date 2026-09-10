-- LMS grants + published curriculum for every campaign tenant.

-- Does not insert volunteers, quiz attempts, or certificates.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_courses TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_modules TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_enrollments TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_module_progress TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_quiz_attempts TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_certificates TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_live_sessions TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_session_attendees TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lms_activity_logs TO authenticated, service_role;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'core-campaign-briefing',
  'Core campaign briefing',
  'Required for every volunteer: values, messaging, safety, data protection, and how we talk to voters.',
  NULL,
  45,
  'published',
  70,
  3,
  TRUE,
  0
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-field_canvassing',
  'Field canvassing',
  'Door-to-door outreach: turf, scripts, logging contacts, and handing off issues.',
  'field_canvassing',
  25,
  'published',
  70,
  3,
  TRUE,
  1
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-phone_banking',
  'Phone banking',
  'Call scripts, consent, call outcomes, and when to stop a conversation.',
  'phone_banking',
  25,
  'published',
  70,
  3,
  TRUE,
  2
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-voter_registration',
  'Voter registration support',
  'Help people check their registration and PVC status without collecting extra data.',
  'voter_registration',
  25,
  'published',
  70,
  3,
  TRUE,
  3
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-digital_outreach',
  'Social media and digital outreach',
  'Share approved posts, report abuse, and never impersonate the campaign.',
  'digital_outreach',
  25,
  'published',
  70,
  3,
  TRUE,
  4
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-event_support',
  'Event and rally support',
  'Crowd flow, materials, accessibility, and incident reporting at events.',
  'event_support',
  25,
  'published',
  70,
  3,
  TRUE,
  5
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-polling_day',
  'Polling-day operations',
  'Your role at the unit, what you may not do, and how to escalate incidents.',
  'polling_day',
  25,
  'published',
  70,
  3,
  TRUE,
  6
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-data_crm',
  'Data entry and CRM',
  'Accurate records, no duplicate contacts, and respect for supporter data.',
  'data_crm',
  25,
  'published',
  70,
  3,
  TRUE,
  7
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-community_outreach',
  'Community outreach',
  'Meetings with local groups, respect for custom, and capturing community asks.',
  'community_outreach',
  25,
  'published',
  70,
  3,
  TRUE,
  8
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-fundraising',
  'Fundraising',
  'Receipts, official channels only, and never cash in a personal account.',
  'fundraising',
  25,
  'published',
  70,
  3,
  TRUE,
  9
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_courses (
  tenant_id, slug, title, description, role_slug, estimated_minutes, status, pass_mark, max_attempts, is_required, sort_order
)
SELECT
  t.id,
  'role-team_leadership',
  'Volunteer team leadership',
  'Brief your team, track attendance, and escalate welfare or conduct issues.',
  'team_leadership',
  25,
  'published',
  70,
  3,
  TRUE,
  10
FROM public.tenants t
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  role_slug = EXCLUDED.role_slug,
  estimated_minutes = EXCLUDED.estimated_minutes,
  status = EXCLUDED.status,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'values-conduct',
  'Campaign values and conduct',
  'lesson',
  'You represent this campaign in every conversation. Be respectful, honest, and calm — even when someone disagrees. Never offer money, gifts, or threats for a vote. Do not speak for the candidate on issues you have not been briefed on. If you are unsure, say you will check with HQ.

Dress neatly, arrive on time, and follow the team lead. Harassment, hate speech, or fighting of any kind is grounds for removal.',
  NULL,
  6,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'campaign-messaging',
  'Campaign messaging',
  'lesson',
  'Stick to the approved talking points: who we are, what we will do, and how voters can take part. Do not invent policies. Do not attack opponents with rumours. If a journalist asks for a quote, direct them to HQ.

When a voter raises a local issue, listen first, write it down, and report it. Listening is part of the message.',
  NULL,
  6,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'messaging-ack',
  'Acknowledge the messaging rules',
  'acknowledgement',
  'I will only use approved campaign talking points, I will not spread rumours, and I will send press requests to HQ.',
  NULL,
  2,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'volunteer-safety',
  'Volunteer safety',
  'lesson',
  'Work in pairs when canvassing. Tell your team lead where you are going. Do not enter a compound if you feel unsafe. Carry water, keep your phone charged, and know the emergency contact for your ward.

Do not argue in the street. Walk away from any confrontation and report it. After dark, stay on main roads and travel with the group.',
  NULL,
  5,
  3,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'data-protection',
  'Data protection',
  'lesson',
  'Voter names, phone numbers, and PVC details are confidential. Do not share lists on WhatsApp groups outside the campaign. Do not photograph a voter’s card unless HQ has asked for a specific, consented check.

Use the campaign tools you are given. If a device is lost, tell HQ immediately.',
  NULL,
  5,
  4,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'voter-etiquette',
  'Voter engagement etiquette',
  'lesson',
  'Introduce yourself and the campaign in one sentence. Ask if it is a good time. Accept no as an answer. Never block a doorway or follow someone who walks away.

Be especially careful with older voters, people at work, and places of worship — follow local custom and the team lead.',
  NULL,
  5,
  5,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'reporting-issues',
  'Reporting issues',
  'lesson',
  'Report incidents, intimidation, missing materials, or rumours through HQ as soon as you can. Include time, place, what you saw, and who was there. Do not post incidents on social media yourself.

Polling-day issues go to the Situation Room. Training issues go to your volunteer coordinator.',
  NULL,
  5,
  6,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'core-resource',
  'Download: field conduct card',
  'resource',
  'Keep this one-page reminder with you in the field.',
  '/learn/resources/conduct-card',
  1,
  7,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'core-quiz',
  'Core knowledge check',
  'quiz',
  NULL,
  NULL,
  6,
  8,
  '{"questions":[{"id":"c1","prompt":"If a voter asks about a policy you have not been briefed on, you should:","choices":["Invent an answer so they are not disappointed","Say you will check with HQ and take their contact","Argue until they agree"],"answer":1},{"id":"c2","prompt":"Voter phone numbers collected in the field may be:","choices":["Posted in any campaign WhatsApp group","Used only in official campaign tools and kept confidential","Sold to help raise funds"],"answer":1},{"id":"c3","prompt":"If a conversation becomes heated at the door, you should:","choices":["Walk away and report it to your team lead","Raise your voice to match theirs","Film them without consent"],"answer":0}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'core-campaign-briefing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Canvassing: how the shift works',
  'lesson',
  'Work your assigned streets only. Mark each compound: home, not home, declined, or follow up. Never skip the log — HQ uses it to avoid visiting the same house twice.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-field_canvassing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Canvassing: field standards',
  'lesson',
  'Open with your name and the campaign. Ask one question at a time. Note the voter’s main issue in their words, not yours.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-field_canvassing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Canvassing: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-field_canvassing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Canvassing check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Leave literature only if the voter accepts it. Do not put flyers in gates or und — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-field_canvassing'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Phone bank: how the shift works',
  'lesson',
  'Call only from the list HQ gives you. Introduce the campaign immediately. If they ask not to be called again, mark Do not call.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-phone_banking'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Phone bank: field standards',
  'lesson',
  'Keep calls short. Capture support level and the main issue. Never record a call unless HQ has set that up with consent.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-phone_banking'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Phone bank: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-phone_banking'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Phone bank check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Do not debate on the phone. Thank them, log the outcome, and move to the next nu — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-phone_banking'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Voter reg: how the shift works',
  'lesson',
  'Explain how to check the INEC register. You are a guide, not INEC staff. Never promise a PVC.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-voter_registration'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Voter reg: field standards',
  'lesson',
  'Do not keep photocopies of IDs. Point people to official channels and campaign help desks.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-voter_registration'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Voter reg: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-voter_registration'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Voter reg check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Log how many people you assisted and any barriers (distance, disability, missing — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-voter_registration'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Digital: how the shift works',
  'lesson',
  'Share only content from official pages. Do not create fake accounts or buy fake engagement.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-digital_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Digital: field standards',
  'lesson',
  'If you see misinformation, screenshot, note the URL, and send it to HQ. Do not pile on in comments.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-digital_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Digital: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-digital_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Digital check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Disclose that you volunteer if you are posting about the campaign from a persona — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-digital_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Events: how the shift works',
  'lesson',
  'Arrive early. Know the entrance, water, first aid, and who the event lead is.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-event_support'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Events: field standards',
  'lesson',
  'Keep walkways clear. Help older guests and people with disabilities first.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-event_support'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Events: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-event_support'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Events check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"If capacity is reached, stop entry calmly and radio the lead. Never force a crow — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-event_support'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Polling day: how the shift works',
  'lesson',
  'You are a campaign volunteer, not INEC. Do not touch ballot materials or interfere with officials.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-polling_day'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Polling day: field standards',
  'lesson',
  'Watch, note, and report. Use the HQ reporting channel. Stay within the rules on observation.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-polling_day'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Polling day: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-polling_day'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Polling day check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Know the difference between a delay, a minor issue, and a serious incident — and — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-polling_day'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Data / CRM: how the shift works',
  'lesson',
  'Enter names and phones exactly as given. Do not guess missing fields.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-data_crm'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Data / CRM: field standards',
  'lesson',
  'Search before creating a contact. Duplicates waste call time and annoy supporters.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-data_crm'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Data / CRM: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-data_crm'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Data / CRM check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Never export a list to personal email or a private drive. — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-data_crm'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Community: how the shift works',
  'lesson',
  'Go with a team lead to first meetings with traditional, religious, or youth leaders.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-community_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Community: field standards',
  'lesson',
  'Listen more than you speak. Write down requests and report them — do not make promises HQ cannot keep.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-community_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Community: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-community_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Community check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Follow dress and greeting customs. Leave when asked. — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-community_outreach'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Fundraising: how the shift works',
  'lesson',
  'Direct donors to the official Paystack or HQ process. Do not collect cash into a personal wallet.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-fundraising'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Fundraising: field standards',
  'lesson',
  'Thank people and log the pledge. HQ issues receipts.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-fundraising'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Fundraising: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-fundraising'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Fundraising check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"Never suggest that a donation buys a job, contract, or favour. — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-fundraising'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-1',
  'Team lead: how the shift works',
  'lesson',
  'Start every shift with a 5-minute briefing: turf, script, safety, and who to call.',
  NULL,
  7,
  0,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-team_leadership'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'procedure-2',
  'Team lead: field standards',
  'lesson',
  'Check who arrived, who is missing, and who needs a ride or water. Log it.',
  NULL,
  7,
  1,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-team_leadership'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'field-assignment',
  'Team lead: practice note',
  'assignment',
  'Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.',
  NULL,
  5,
  2,
  NULL
FROM public.lms_courses c
WHERE c.slug = 'role-team_leadership'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;

INSERT INTO public.lms_modules (
  tenant_id, course_id, slug, title, kind, body, resource_url, estimated_minutes, sort_order, quiz
)
SELECT
  c.tenant_id,
  c.id,
  'role-quiz',
  'Team lead check',
  'quiz',
  NULL,
  NULL,
  6,
  3,
  '{"questions":[{"id":"r1","prompt":"The main purpose of this role training is to:","choices":["Replace HQ instructions with your own","Follow campaign procedure for this assignment","Skip the core briefing"],"answer":1},{"id":"r2","prompt":"If someone breaks conduct rules, pause their work and call the volunteer coordin — you should:","choices":["Ignore HQ if it is slower","Follow the standard and report problems","Post complaints publicly first"],"answer":1},{"id":"r3","prompt":"If you are unsure what to do in the field:","choices":["Guess and hope","Ask your team lead or coordinator","Leave without telling anyone"],"answer":1}]}'::jsonb
FROM public.lms_courses c
WHERE c.slug = 'role-team_leadership'
ON CONFLICT (course_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  resource_url = EXCLUDED.resource_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  quiz = EXCLUDED.quiz;
