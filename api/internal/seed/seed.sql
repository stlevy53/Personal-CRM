-- Prototype demo dataset (dev only). Mirrors assets/js/data.js so the API
-- returns the same content the HTML prototype showed.

-- Pods
INSERT INTO pods (id, name) VALUES
  ('cloud-infra', 'Cloud Infrastructure'),
  ('platform',    'Platform Engineering'),
  ('devex',       'Developer Experience'),
  ('data',        'Data Platform');

-- MGT people
INSERT INTO engineers (id, name, initials, pod_id) VALUES
  ('mp', 'M. Patel',     'MP', 'cloud-infra'),
  ('sc', 'S. Chen',      'SC', 'cloud-infra'),
  ('ar', 'A. Rodriguez', 'AR', 'devex'),
  ('kw', 'K. Williams',  'KW', 'platform'),
  ('jl', 'J. Liu',       'JL', 'data');

-- App statuses
INSERT INTO app_statuses (key, label, badge, position) VALUES
  ('prototype',      'Prototype',      'badge-prototype',  0),
  ('pre-production', 'Pre-Production', 'badge-preprod',    1),
  ('production',     'Production',     'badge-prod',       2),
  ('soft-launch',    'Soft Launch',    'badge-proto',      3),
  ('live-worldwide', 'Live Worldwide', 'badge-live',       4),
  ('sunsetting',     'Sunsetting',     'badge-sunsetting', 5),
  ('sunset',         'Sunset',         'badge-sunset',     6);

-- Org hierarchy
INSERT INTO subdivisions (id, name) VALUES
  ('trinity', 'Nova'),
  ('vertex',     'Vertex');

INSERT INTO studios (id, name, subdivision_id) VALUES
  ('atlas-studio',   'Atlas Studio',           'trinity'),
  ('gram',       'Halcyon Games',         'trinity'),
  ('vertex-casino', 'Vertex Casino & Cards', 'vertex'),
  ('vertex-casual', 'Vertex Casual',         'vertex');

-- Customers
INSERT INTO customers (id, name, studio_id, app_status, slack_channel, services) VALUES
  ('fv3',   'Frontier Quest 3',          'atlas-studio',   'production',     '#fv3-mgt-support',   '{k8s,aws,obs,ci}'),
  ('poker', 'Acme Poker',          'vertex-casino', 'production',     '#poker-mgt-support', '{aws,db}'),
  ('wwf',   'Puzzle Pals 3', 'vertex-casual', 'production',     '#wwf-mgt-support',   '{k8s,obs}'),
  ('md',    'Merge Kingdoms!',       'gram',       'pre-production', '#md-mgt-support',    '{ci,aws}'),
  ('hpp',   'Mystic Manor Puzzles', 'vertex-casual', 'pre-production', '#hpp-mgt-support',   '{aws,ci}');

-- Contacts
INSERT INTO contacts (id, name, email, slack, role, customer_id) VALUES
  ('je',     'Jordan Ellis',  'j.ellis@acme.example.com',   '@j_ellis',    'Lead Engineer',       'fv3'),
  ('pm-fv3', 'Priya Mehta',   'p.mehta@acme.example.com',   '@p_mehta',    'DevOps Engineer',     'fv3'),
  ('dk',     'Daniel Kim',    'd.kim@acme.example.com',     '@d_kim',      'Engineering Manager', 'fv3'),
  ('tc',     'Tyler Chen',    't.chen@acme.example.com',    '@t_chen',     'Senior Engineer',     'poker'),
  ('sp',     'Sara Park',     's.park@acme.example.com',    '@s_park',     'DevOps Engineer',     'poker'),
  ('rb',     'Rachel Brooks', 'r.brooks@acme.example.com',  '@r_brooks',   'Lead Engineer',       'wwf'),
  ('lp',     'Luis Perez',    'l.perez@acme.example.com',   '@l_perez',    'Backend Engineer',    'md'),
  ('em',     'Emma Martinez', 'e.martinez@acme.example.com','@e_martinez', 'DevOps Engineer',     'hpp');

-- Team notes
INSERT INTO team_notes (id, customer_id, author_id, text, created_at) VALUES
  ('tn1', 'fv3', 'sc', 'FV3 team is ramping a new DevOps hire (start date April). Expect heavier questions on K8s and observability setup in Q2. Worth proactive outreach once they''re onboarded.', now() - interval '1 day'),
  ('tn2', 'fv3', 'mp', 'Recurring pattern: K8s resource limits questions stem from FV3 not yet using the self-service limit calculator in the portal. Onboarded Jordan on this. Should be less frequent now.', now() - interval '15 days'),
  ('tn3', 'fv3', 'ar', 'Team went live Dec 2025. Good team, quick communicators. Primary contact Jordan Ellis is technically strong. Prefers Slack over email.', now() - interval '85 days');

-- Interactions
INSERT INTO interactions (id, type, title, date, notes, tags, customer_id, logged_by, created_at) VALUES
  ('INTR-0012', 'meeting', 'Q2 infrastructure planning sync', now() - interval '2 days',
   'Reviewed FV3 Q2 roadmap. They are planning a major LiveOps event in May expecting ~2x peak concurrency (target 700k CCU). Discussed pre-scaling the HPA and reserving additional node capacity. Priya raised that their current observability dashboards do not surface per-region latency, which makes incident triage slow. We committed to helping them set up regional latency panels before the event.',
   '{liveops,scaling,observability,q2-planning}', 'fv3', 'mp', now() - interval '2 days'),
  ('INTR-0011', 'call', 'Onboarding new DevOps hire', now() - interval '5 days',
   'Intro call with FV3 about their incoming DevOps engineer starting in April. Daniel wants us to run a half-day onboarding session covering our K8s self-service tooling, the limit calculator, and CI/CD pipeline conventions. Good opportunity to reduce repeat questions.',
   '{onboarding,enablement}', 'fv3', 'mp', now() - interval '5 days'),
  ('INTR-0010', 'meeting', 'Poker DB scaling review', now() - interval '6 days',
   'Acme Poker is seeing connection pool pressure during peak tournaments. Walked through read-replica options and connection pooling (PgBouncer) with Tyler. They are interested but want a cost estimate before committing. Sara will share their current connection metrics so we can right-size.',
   '{database,scaling,cost}', 'poker', 'jl', now() - interval '6 days'),
  ('INTR-0009', 'slack', 'WWF2 observability dashboard gap', now() - interval '8 days',
   'Rachel pinged about custom game metrics disappearing from dashboards after their last deploy. Root cause was a renamed metric prefix. Helped them update the dashboard queries. Flagged that they should pin metric names in their instrumentation config to avoid this recurring.',
   '{observability,incident}', 'wwf', 'kw', now() - interval '8 days'),
  ('INTR-0008', 'meeting', 'Merge Kingdoms pre-production readiness', now() - interval '12 days',
   'Merge Kingdoms is moving from prototype to pre-production. Reviewed their CI/CD setup - currently build times are ~30min which will slow them down. Recommended migrating to our Anvil remote cache. Luis is keen. Also discussed AWS account structure for their staging environment.',
   '{ci-cd,pre-production,aws}', 'md', 'ar', now() - interval '12 days'),
  ('INTR-0007', 'call', 'Mystic Manor Puzzles kickoff', now() - interval '18 days',
   'First infrastructure planning call with HPP. They are in pre-production targeting a soft launch in Q3. Need AWS provisioning and a CI/CD pipeline. Emma is the main technical contact. Walked through our standard pre-production onboarding checklist.',
   '{onboarding,pre-production,aws,ci-cd}', 'hpp', 'sc', now() - interval '18 days'),
  ('INTR-0006', 'meeting', 'FV3 incident retro - autoscaler outage', now() - interval '22 days',
   'Post-incident review of the HPA scaling failure that impacted ~340k players. Root cause was a metrics-server certificate expiry that blocked custom metric scraping. Agreed on action items: add cert expiry alerting, document the runbook, and add a synthetic check for the metrics pipeline.',
   '{incident,retro,kubernetes,reliability}', 'fv3', 'mp', now() - interval '22 days'),
  ('INTR-0004', 'email', 'Poker observability alert tuning', now() - interval '38 days',
   'Email thread with Sara about alert thresholds being too noisy after their game relaunch. Adjusted thresholds for CPU and latency alerts. Recommended they adopt our standard alerting profile for production games.',
   '{observability,alerting}', 'poker', 'kw', now() - interval '38 days'),
  ('INTR-0003', 'meeting', 'WWF2 quarterly relationship check-in', now() - interval '45 days',
   'Quarterly check-in with Rachel. Overall WWF2 is happy with platform stability. They flagged interest in adopting our new observability tracing features. No urgent issues. Good relationship, low-maintenance team.',
   '{check-in,relationship,observability}', 'wwf', 'mp', now() - interval '45 days'),
  ('INTR-0002', 'call', 'FV3 CI build time regression', now() - interval '60 days',
   'Jordan reported CI build times regressed from 12min to 45min after a toolchain upgrade. Diagnosed a cache invalidation issue in the build config. Helped them restore remote cache hits. Build times back to ~14min.',
   '{ci-cd,performance}', 'fv3', 'ar', now() - interval '60 days'),
  ('INTR-0001', 'meeting', 'Poker DB connection pool incident review', now() - interval '72 days',
   'Reviewed a critical incident where the Poker DB connection pool hit max connections during a peak tournament. Implemented an emergency pool size increase. Longer term, this is what kicked off the read-replica conversation. Tyler very engaged.',
   '{database,incident,scaling}', 'poker', 'jl', now() - interval '72 days');

-- Internal (MGT) attendees
INSERT INTO interaction_attendees_mgt (interaction_id, engineer_id) VALUES
  ('INTR-0012','mp'), ('INTR-0012','sc'),
  ('INTR-0011','mp'),
  ('INTR-0010','jl'),
  ('INTR-0009','kw'),
  ('INTR-0008','ar'), ('INTR-0008','sc'),
  ('INTR-0007','sc'), ('INTR-0007','ar'),
  ('INTR-0006','mp'), ('INTR-0006','sc'),
  ('INTR-0004','kw'),
  ('INTR-0003','kw'), ('INTR-0003','mp'),
  ('INTR-0002','ar'),
  ('INTR-0001','jl');

-- External (customer) attendees
INSERT INTO interaction_attendees_external (interaction_id, contact_id) VALUES
  ('INTR-0012','je'), ('INTR-0012','pm-fv3'),
  ('INTR-0011','dk'),
  ('INTR-0010','tc'), ('INTR-0010','sp'),
  ('INTR-0009','rb'),
  ('INTR-0008','lp'),
  ('INTR-0007','em'),
  ('INTR-0006','je'), ('INTR-0006','pm-fv3'), ('INTR-0006','dk'),
  ('INTR-0004','sp'),
  ('INTR-0003','rb'),
  ('INTR-0002','je'),
  ('INTR-0001','tc');

-- Action items (commitments)
INSERT INTO action_items (interaction_id, position, text, owner_id, due_date, status) VALUES
  ('INTR-0012', 0, 'MGT to provision additional node capacity for May event', 'mp', '2026-04-15', 'open'),
  ('INTR-0012', 1, 'Help FV3 build per-region latency dashboards', 'sc', '2026-04-30', 'open'),
  ('INTR-0012', 2, 'Schedule load test 2 weeks before event', 'mp', '2026-05-01', 'open'),
  ('INTR-0011', 0, 'Prepare onboarding deck for new FV3 hire', 'mp', '2026-04-10', 'open'),
  ('INTR-0011', 1, 'Book half-day session for late April', 'mp', NULL, 'open'),
  ('INTR-0010', 0, 'Provide cost estimate for read replicas', 'jl', '2026-04-12', 'open'),
  ('INTR-0010', 1, 'Sara to share connection pool metrics', NULL, NULL, 'open'),
  ('INTR-0010', 2, 'Evaluate PgBouncer rollout', 'jl', NULL, 'open'),
  ('INTR-0009', 0, 'WWF2 to pin metric names in config', NULL, NULL, 'open'),
  ('INTR-0008', 0, 'Help MD migrate to Anvil remote build cache', NULL, NULL, 'open'),
  ('INTR-0008', 1, 'Set up dedicated staging AWS account', NULL, NULL, 'open'),
  ('INTR-0008', 2, 'Follow up on namespace quota needs', NULL, NULL, 'open'),
  ('INTR-0007', 0, 'Send HPP pre-production onboarding checklist', NULL, NULL, 'open'),
  ('INTR-0007', 1, 'Provision initial AWS account', NULL, NULL, 'open'),
  ('INTR-0007', 2, 'Schedule CI/CD setup session', NULL, NULL, 'open'),
  ('INTR-0006', 0, 'Add certificate expiry alerting', NULL, NULL, 'open'),
  ('INTR-0006', 1, 'Write autoscaler runbook', NULL, NULL, 'open'),
  ('INTR-0006', 2, 'Add synthetic check for metrics pipeline', NULL, NULL, 'open'),
  ('INTR-0004', 0, 'Apply standard production alerting profile to Poker', NULL, NULL, 'open'),
  ('INTR-0003', 0, 'Share observability tracing rollout timeline with WWF2', NULL, NULL, 'open'),
  ('INTR-0002', 0, 'Document cache config best practices', NULL, NULL, 'open'),
  ('INTR-0001', 0, 'Plan read-replica architecture for Poker', NULL, NULL, 'open');

-- Audit log
INSERT INTO audit_log (id, ts, actor_id, action, record_type, record_id, detail) VALUES
  ('a1', now() - interval '2 days', 'mp', 'Interaction Logged', 'Interaction', 'INTR-0012', 'Meeting - Frontier Quest 3'),
  ('a2', now() - interval '5 days', 'mp', 'Interaction Logged', 'Interaction', 'INTR-0011', 'Call - Frontier Quest 3'),
  ('a3', now() - interval '6 days', 'jl', 'Interaction Logged', 'Interaction', 'INTR-0010', 'Meeting - Acme Poker'),
  ('a4', now() - interval '1 day',  'sc', 'Team Note Added',    'Profile',     'fv3',       'Note added to Frontier Quest 3'),
  ('a5', now() - interval '8 days', 'kw', 'Interaction Logged', 'Interaction', 'INTR-0009', 'Slack - Puzzle Pals 3');
