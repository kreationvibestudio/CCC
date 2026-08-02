-- Seed data for Campaign Command Center demo

-- Demo tenant
INSERT INTO tenants (id, name, slug, election_date, campaign_end_date, fundraising_goal)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Progressive Alliance 2027',
  'progressive-alliance-2027',
  '2027-02-27 08:00:00+01',
  '2027-02-20 23:59:59+01',
  500000000
);

-- Nigerian geography sample (Lagos focus)
INSERT INTO states (id, code, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'LA', 'Lagos'),
  ('b0000000-0000-0000-0000-000000000002', 'AB', 'Abuja FCT'),
  ('b0000000-0000-0000-0000-000000000003', 'KN', 'Kano');

INSERT INTO lgas (id, state_id, code, name) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'IKJ', 'Ikeja'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'EPE', 'Epe'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'AMAC', 'Abuja Municipal');

INSERT INTO wards (id, lga_id, code, name) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'W01', 'Alausa'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'W02', 'Oregun'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'W01', 'Epe Town');

-- Polling units
INSERT INTO polling_units (tenant_id, ward_id, code, name, ward, lga, state, registered_voters, latitude, longitude, address, risk_level) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'LA/IKJ/01/001', 'Alausa Primary School', 'Alausa', 'Ikeja', 'Lagos', 1250, 6.6140, 3.3489, 'Obafemi Awolowo Way, Ikeja', 'low'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'LA/IKJ/01/002', 'Ikeja LGA Secretariat', 'Alausa', 'Ikeja', 'Lagos', 980, 6.6018, 3.3515, 'Obafemi Awolowo Way, Ikeja', 'low'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'LA/IKJ/02/001', 'Oregun Community Hall', 'Oregun', 'Ikeja', 'Lagos', 1100, 6.5789, 3.3678, 'Kudirat Abiola Way, Oregun', 'medium'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'LA/EPE/01/001', 'Epe Town Hall', 'Epe Town', 'Epe', 'Lagos', 850, 6.5840, 3.9832, 'Pobo Road, Epe', 'low'),
  ('a0000000-0000-0000-0000-000000000001', NULL, 'FC/AMAC/01/001', 'Area 10 Shopping Complex', 'Garki', 'AMAC', 'Abuja FCT', 1450, 9.0470, 7.4891, 'Area 10, Garki, Abuja', 'low');

-- Social accounts (disconnected stubs)
INSERT INTO social_accounts (tenant_id, platform, account_name, is_connected, followers) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'facebook', '@ProgressiveAllianceNG', false, 125000),
  ('a0000000-0000-0000-0000-000000000001', 'instagram', '@progressivealliance', false, 89000),
  ('a0000000-0000-0000-0000-000000000001', 'x', '@PA_Nigeria', false, 67000),
  ('a0000000-0000-0000-0000-000000000001', 'tiktok', '@progressivealliance', false, 45000),
  ('a0000000-0000-0000-0000-000000000001', 'youtube', 'Progressive Alliance Nigeria', false, 32000);

-- Sample comments
INSERT INTO comments (tenant_id, platform, platform_comment_id, author_name, content, sentiment, issue_topic, priority_score, status, ward, lga, is_misinformation, is_abusive, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'facebook', 'fb_001', 'Adaeze Okafor', 'We need better roads in Ikeja! The potholes are terrible.', 'negative', 'roads', 75, 'pending', 'Alausa', 'Ikeja', false, false, NOW() - INTERVAL '2 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'x', 'x_001', 'Emeka Nwosu', 'Great town hall meeting yesterday. Finally a candidate who listens!', 'positive', 'other', 30, 'resolved', 'Oregun', 'Ikeja', false, false, NOW() - INTERVAL '5 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'instagram', 'ig_001', 'Fatima Bello', 'What is your plan for youth employment? 40% of us are unemployed.', 'neutral', 'employment', 85, 'assigned', 'Epe Town', 'Epe', false, false, NOW() - INTERVAL '1 hour'),
  ('a0000000-0000-0000-0000-000000000001', 'facebook', 'fb_002', 'Anonymous User', 'They said candidate withdrew from race - is this true?', 'negative', 'other', 95, 'flagged', NULL, NULL, true, false, NOW() - INTERVAL '30 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'youtube', 'yt_001', 'Chidi Okonkwo', 'Healthcare in rural areas needs urgent attention. No hospitals nearby.', 'negative', 'healthcare', 80, 'pending', 'Epe Town', 'Epe', false, false, NOW() - INTERVAL '3 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'tiktok', 'tt_001', 'Amina Yusuf', 'Love the energy at the rally! Nigeria will be great again!', 'positive', 'youth', 20, 'replied', 'Alausa', 'Ikeja', false, false, NOW() - INTERVAL '6 hours');

-- Volunteers
INSERT INTO volunteers (tenant_id, full_name, phone, email, ward, lga, skills, languages, training_status, performance_rating) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Blessing Adeyemi', '+2348012345678', 'blessing@email.com', 'Alausa', 'Ikeja', ARRAY['canvassing', 'phone_banking'], ARRAY['English', 'Yoruba'], 'completed', 4.5),
  ('a0000000-0000-0000-0000-000000000001', 'Ibrahim Musa', '+2348023456789', 'ibrahim@email.com', 'Oregun', 'Ikeja', ARRAY['event_coordination'], ARRAY['English', 'Hausa'], 'completed', 4.2),
  ('a0000000-0000-0000-0000-000000000001', 'Grace Etim', '+2348034567890', 'grace@email.com', 'Epe Town', 'Epe', ARRAY['social_media', 'data_entry'], ARRAY['English', 'Ibibio'], 'in_progress', 3.8),
  ('a0000000-0000-0000-0000-000000000001', 'Tunde Bakare', '+2348045678901', 'tunde@email.com', 'Alausa', 'Ikeja', ARRAY['security', 'logistics'], ARRAY['English', 'Yoruba'], 'completed', 4.7);

-- CRM contacts
INSERT INTO contacts (tenant_id, full_name, contact_type, phone, ward, lga, support_level, total_donations) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Chief Oladipo Shonibare', 'traditional_ruler', '+2348056789012', 'Alausa', 'Ikeja', 'strong', 500000),
  ('a0000000-0000-0000-0000-000000000001', 'Pastor Emeka Uche', 'religious_leader', '+2348067890123', 'Oregun', 'Ikeja', 'leaning', 150000),
  ('a0000000-0000-0000-0000-000000000001', 'Hajiya Amina Garba', 'women_leader', '+2348078901234', 'Epe Town', 'Epe', 'strong', 250000),
  ('a0000000-0000-0000-0000-000000000001', 'David Okon', 'donor', '+2348089012345', 'Garki', 'AMAC', 'strong', 2000000);

-- Donations
INSERT INTO donations (tenant_id, contact_id, amount, payment_method) 
SELECT 'a0000000-0000-0000-0000-000000000001', id, total_donations, 'bank_transfer'
FROM contacts WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Campaign events
INSERT INTO campaign_events (tenant_id, title, event_type, description, location, ward, lga, starts_at, ends_at, max_attendees) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Ikeja Town Hall Meeting', 'town_hall', 'Open forum on infrastructure and economy', 'Ikeja City Hall', 'Alausa', 'Ikeja', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '3 hours', 500),
  ('a0000000-0000-0000-0000-000000000001', 'Youth Rally - Lagos', 'rally', 'Mobilizing young voters across Lagos', 'Tafawa Balewa Square', 'Alausa', 'Ikeja', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '5 hours', 10000),
  ('a0000000-0000-0000-0000-000000000001', 'Ward Meeting - Epe', 'ward_meeting', 'Grassroots engagement in Epe LGA', 'Epe Town Hall', 'Epe Town', 'Epe', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 200);

-- Polling unit status
INSERT INTO polling_unit_status (tenant_id, polling_unit_id, status, turnout)
SELECT 'a0000000-0000-0000-0000-000000000001', id,
  CASE code
    WHEN 'LA/IKJ/01/001' THEN 'voting_in_progress'::pu_status
    WHEN 'LA/IKJ/01/002' THEN 'delayed'::pu_status
    WHEN 'LA/IKJ/02/001' THEN 'minor_issue'::pu_status
    WHEN 'LA/EPE/01/001' THEN 'not_active'::pu_status
    ELSE 'not_active'::pu_status
  END,
  CASE code
    WHEN 'LA/IKJ/01/001' THEN 342
    WHEN 'LA/IKJ/01/002' THEN 156
    ELSE 0
  END
FROM polling_units WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Message templates
INSERT INTO message_templates (tenant_id, name, channel, subject, body) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Event Reminder', 'sms', NULL, 'Hello {{name}}, reminder: {{event_name}} is on {{date}} at {{location}}. See you there! - PA Campaign'),
  ('a0000000-0000-0000-0000-000000000001', 'Volunteer Welcome', 'whatsapp', NULL, 'Welcome to the Progressive Alliance volunteer team, {{name}}! Your ward coordinator will contact you shortly.'),
  ('a0000000-0000-0000-0000-000000000001', 'Donation Thank You', 'email', 'Thank You for Your Support', 'Dear {{name}}, thank you for your generous donation of {{amount}}. Together we will build a better Nigeria.');

-- AI briefing sample
INSERT INTO ai_briefings (tenant_id, briefing_date, content) VALUES
  ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '{
    "summary": "Campaign momentum is strong with positive sentiment at 62%. Roads and employment dominate discussions.",
    "top_issues": ["roads", "employment", "healthcare"],
    "sentiment_breakdown": {"positive": 62, "neutral": 23, "negative": 15},
    "best_post": {"platform": "instagram", "engagement": 12500, "topic": "youth employment plan"},
    "worst_post": {"platform": "facebook", "engagement": -340, "topic": "misinformation about withdrawal"},
    "emerging_concerns": ["misinformation about candidate withdrawal", "healthcare access in Epe"],
    "misinformation_trends": 2,
    "volunteer_activity": {"checkins_today": 47, "tasks_completed": 23},
    "geographic_hotspots": ["Ikeja", "Epe"],
    "recommendations": [
      "Address road infrastructure concerns in Ikeja ward meetings",
      "Deploy fact-check team for withdrawal rumors",
      "Increase youth employment content on TikTok and Instagram"
    ],
    "suggested_content": "Short video: 3-point plan for fixing Ikeja roads within 100 days",
    "speech_talking_points": ["Infrastructure investment", "Youth job creation", "Healthcare for rural communities"]
  }');

-- Admin user: create in Supabase Dashboard → Authentication → Users
-- Then run supabase/cloud-admin.sql

-- Activities
INSERT INTO activities (tenant_id, action, description, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'comment.received', 'New high-priority comment about youth employment on Instagram', NOW() - INTERVAL '1 hour'),
  ('a0000000-0000-0000-0000-000000000001', 'volunteer.checkin', 'Blessing Adeyemi checked in at Alausa ward office', NOW() - INTERVAL '2 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'donation.received', 'New donation of ₦2,000,000 from David Okon', NOW() - INTERVAL '4 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'incident.reported', 'Minor delay reported at Ikeja LGA Secretariat polling unit', NOW() - INTERVAL '30 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'event.created', 'Youth Rally scheduled for Tafawa Balewa Square', NOW() - INTERVAL '1 day');
