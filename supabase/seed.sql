-- Seed data for Campaign Command Center demo (Edo / Esan focus)

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

-- Nigerian geography sample (Edo / Esan LGAs)
INSERT INTO states (id, code, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'ED', 'Edo');

INSERT INTO lgas (id, state_id, code, name) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ENE', 'Esan North-East'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'ESE', 'Esan South-East');

INSERT INTO wards (id, lga_id, code, name) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'W01', 'Uromi I'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'W02', 'Irrua'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'W03', 'Ewu'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'W01', 'Ugboha'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'W02', 'Ewohimi');

-- Sample Esan polling units (expand with: npm run pu:import -- supabase/data/edo-esan-polling-units.csv)
INSERT INTO polling_units (tenant_id, ward_id, code, name, ward, lga, state, registered_voters, latitude, longitude, address, risk_level) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '12/04/01/001', 'Uromi Town Hall', 'Uromi I', 'Esan North-East', 'Edo', 1320, 6.7200, 6.3300, 'Uromi Town Hall, Esan North-East', 'low'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '12/04/01/002', 'Uromi Market Square', 'Uromi I', 'Esan North-East', 'Edo', 1180, 6.7185, 6.3312, 'Uromi Market Square', 'low'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '12/04/02/001', 'Irrua General Hospital', 'Irrua', 'Esan North-East', 'Edo', 1410, 6.7420, 6.2190, 'Irrua General Hospital', 'medium'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '12/04/02/002', 'Irrua Grammar School', 'Irrua', 'Esan North-East', 'Edo', 990, 6.7405, 6.2210, 'Irrua Grammar School', 'low'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', '12/04/03/001', 'Ewu Primary School', 'Ewu', 'Esan North-East', 'Edo', 870, 6.8010, 6.2500, 'Ewu Primary School', 'low'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '12/05/01/001', 'Ugboha Town Hall', 'Ugboha', 'Esan South-East', 'Edo', 1105, 6.6900, 6.4100, 'Ugboha Town Hall', 'medium'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', '12/05/02/001', 'Ewohimi Central School', 'Ewohimi', 'Esan South-East', 'Edo', 960, 6.6500, 6.4500, 'Ewohimi Central School', 'low');

-- Social accounts (disconnected stubs — connect via Facebook sync in production)
INSERT INTO social_accounts (tenant_id, platform, account_name, is_connected, followers) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'facebook', '@ProgressiveAllianceNG', false, 125000),
  ('a0000000-0000-0000-0000-000000000001', 'instagram', '@progressivealliance', false, 89000),
  ('a0000000-0000-0000-0000-000000000001', 'x', '@PA_Nigeria', false, 67000),
  ('a0000000-0000-0000-0000-000000000001', 'tiktok', '@progressivealliance', false, 45000),
  ('a0000000-0000-0000-0000-000000000001', 'youtube', 'Progressive Alliance Nigeria', false, 32000);

-- Sample comments
INSERT INTO comments (tenant_id, platform, platform_comment_id, author_name, content, sentiment, issue_topic, priority_score, status, ward, lga, is_misinformation, is_abusive, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'facebook', 'fb_001', 'Adaeze Okosun', 'We need better roads in Uromi! The potholes are terrible.', 'negative', 'roads', 75, 'pending', 'Uromi I', 'Esan North-East', false, false, NOW() - INTERVAL '2 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'x', 'x_001', 'Emeka Ijie', 'Great town hall in Irrua yesterday. Finally a candidate who listens!', 'positive', 'other', 30, 'resolved', 'Irrua', 'Esan North-East', false, false, NOW() - INTERVAL '5 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'instagram', 'ig_001', 'Fatima Ede', 'What is your plan for youth employment across Esan?', 'neutral', 'employment', 85, 'assigned', 'Ewu', 'Esan North-East', false, false, NOW() - INTERVAL '1 hour'),
  ('a0000000-0000-0000-0000-000000000001', 'facebook', 'fb_002', 'Anonymous User', 'They said candidate withdrew from race - is this true?', 'negative', 'other', 95, 'flagged', NULL, NULL, true, false, NOW() - INTERVAL '30 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'youtube', 'yt_001', 'Chidi Okojie', 'Healthcare in Ugboha needs urgent attention. No hospitals nearby.', 'negative', 'healthcare', 80, 'pending', 'Ugboha', 'Esan South-East', false, false, NOW() - INTERVAL '3 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'tiktok', 'tt_001', 'Amina Esene', 'Love the energy at the Ewohimi rally!', 'positive', 'youth', 20, 'replied', 'Ewohimi', 'Esan South-East', false, false, NOW() - INTERVAL '6 hours');

-- Volunteers
INSERT INTO volunteers (tenant_id, full_name, phone, email, ward, lga, skills, languages, training_status, performance_rating) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Blessing Okoh', '+2348012345678', 'blessing@email.com', 'Uromi I', 'Esan North-East', ARRAY['canvassing', 'phone_banking'], ARRAY['English', 'Esan'], 'completed', 4.5),
  ('a0000000-0000-0000-0000-000000000001', 'Ibrahim Musa', '+2348023456789', 'ibrahim@email.com', 'Irrua', 'Esan North-East', ARRAY['event_coordination'], ARRAY['English', 'Hausa'], 'completed', 4.2),
  ('a0000000-0000-0000-0000-000000000001', 'Grace Ehimare', '+2348034567890', 'grace@email.com', 'Ugboha', 'Esan South-East', ARRAY['social_media', 'data_entry'], ARRAY['English', 'Esan'], 'in_progress', 3.8),
  ('a0000000-0000-0000-0000-000000000001', 'Tunde Osagie', '+2348045678901', 'tunde@email.com', 'Ewohimi', 'Esan South-East', ARRAY['security', 'logistics'], ARRAY['English', 'Esan'], 'completed', 4.7);

-- CRM contacts
INSERT INTO contacts (tenant_id, full_name, contact_type, phone, ward, lga, support_level, total_donations) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'HRH Onojie of Uromi', 'traditional_ruler', '+2348056789012', 'Uromi I', 'Esan North-East', 'strong', 500000),
  ('a0000000-0000-0000-0000-000000000001', 'Pastor Emeka Ibhaze', 'religious_leader', '+2348067890123', 'Irrua', 'Esan North-East', 'leaning', 150000),
  ('a0000000-0000-0000-0000-000000000001', 'Chief (Mrs) Amina Okosun', 'women_leader', '+2348078901234', 'Ewu', 'Esan North-East', 'strong', 250000),
  ('a0000000-0000-0000-0000-000000000001', 'David Okojie', 'donor', '+2348089012345', 'Ugboha', 'Esan South-East', 'strong', 2000000);

-- Donations
INSERT INTO donations (tenant_id, contact_id, amount, payment_method)
SELECT 'a0000000-0000-0000-0000-000000000001', id, total_donations, 'bank_transfer'
FROM contacts WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Campaign events
INSERT INTO campaign_events (tenant_id, title, event_type, description, location, ward, lga, starts_at, ends_at, max_attendees) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Uromi Town Hall Meeting', 'town_hall', 'Open forum on infrastructure and economy in Esan North-East', 'Uromi Town Hall', 'Uromi I', 'Esan North-East', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '3 hours', 500),
  ('a0000000-0000-0000-0000-000000000001', 'Youth Rally - Esan', 'rally', 'Mobilizing young voters across Esan LGAs', 'Irrua Grammar School Field', 'Irrua', 'Esan North-East', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '5 hours', 10000),
  ('a0000000-0000-0000-0000-000000000001', 'Ward Meeting - Ugboha', 'ward_meeting', 'Grassroots engagement in Esan South-East', 'Ugboha Town Hall', 'Ugboha', 'Esan South-East', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 200);

-- Polling unit status
INSERT INTO polling_unit_status (tenant_id, polling_unit_id, status, turnout)
SELECT 'a0000000-0000-0000-0000-000000000001', id,
  CASE code
    WHEN '12/04/01/001' THEN 'voting_in_progress'::pu_status
    WHEN '12/04/01/002' THEN 'delayed'::pu_status
    WHEN '12/04/02/001' THEN 'minor_issue'::pu_status
    WHEN '12/05/01/001' THEN 'not_active'::pu_status
    ELSE 'not_active'::pu_status
  END,
  CASE code
    WHEN '12/04/01/001' THEN 342
    WHEN '12/04/01/002' THEN 156
    ELSE 0
  END
FROM polling_units WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Message templates (Termii SMS is the supported send channel)
INSERT INTO message_templates (tenant_id, name, channel, subject, body) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Event Reminder', 'sms', NULL, 'Hello {{name}}, reminder: join us in Esan. See you there! - PA Campaign'),
  ('a0000000-0000-0000-0000-000000000001', 'Volunteer Welcome', 'sms', NULL, 'Welcome to the Progressive Alliance volunteer team, {{name}}! Your ward coordinator will contact you shortly.'),
  ('a0000000-0000-0000-0000-000000000001', 'Donation Thank You', 'sms', NULL, 'Dear {{name}}, thank you for your support. Together we will build a better Edo.');

-- AI briefing sample
INSERT INTO ai_briefings (tenant_id, briefing_date, content) VALUES
  ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '{
    "summary": "Campaign momentum is strong across Esan with positive sentiment at 62%. Roads and employment dominate discussions.",
    "top_issues": ["roads", "employment", "healthcare"],
    "sentiment_breakdown": {"positive": 62, "neutral": 23, "negative": 15},
    "best_post": {"platform": "instagram", "engagement": 12500, "topic": "youth employment plan"},
    "worst_post": {"platform": "facebook", "engagement": -340, "topic": "misinformation about withdrawal"},
    "emerging_concerns": ["misinformation about candidate withdrawal", "healthcare access in Ugboha"],
    "misinformation_trends": 2,
    "volunteer_activity": {"checkins_today": 47, "tasks_completed": 23},
    "geographic_hotspots": ["Uromi", "Irrua", "Ugboha"],
    "recommendations": [
      "Address road infrastructure concerns in Uromi ward meetings",
      "Deploy fact-check team for withdrawal rumors",
      "Increase youth employment content on TikTok and Instagram"
    ],
    "suggested_content": "Short video: 3-point plan for fixing Uromi–Irrua roads within 100 days",
    "alerts": []
  }'::jsonb);

-- Demo SMS campaign draft (send from Communications UI once TERMII_API_KEY is set)
INSERT INTO message_campaigns (tenant_id, name, channel, status, sent_count)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Esan Weekend Reminder', 'sms', 'draft', 0);
