-- VoxYZ Dashboard Rebuild - Database Schema
-- Matching voxyz.space structure

-- Add RPG stats to agents
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS wisdom INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS trust INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS speed INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS creativity INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS daily_ops INT DEFAULT 0;
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP DEFAULT NOW();
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS affect TEXT DEFAULT 'focused';
ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS current_thought TEXT;

-- Role cards for each agent
CREATE TABLE IF NOT EXISTS ops_role_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES ops_agents(id) ON DELETE CASCADE,
  skills TEXT[] DEFAULT '{}',
  equipment_inputs TEXT[] DEFAULT '{}',
  equipment_outputs TEXT[] DEFAULT '{}',
  sealed_abilities TEXT[] DEFAULT '{}',
  escalation_triggers TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Radar ideas pipeline
CREATE TABLE IF NOT EXISTS ops_radar_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'watching' CHECK (status IN ('watching', 'validating', 'building', 'shipped')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  votes INT DEFAULT 0,
  drafted_by TEXT,
  source TEXT,
  preview_url TEXT,
  live_url TEXT,
  clone_url TEXT,
  prompt_pack TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insights/blog posts by agents
CREATE TABLE IF NOT EXISTS ops_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT DEFAULT 'insight' CHECK (type IN ('insight', 'blog_post')),
  author_agent_id TEXT REFERENCES ops_agents(id),
  pinned BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stage events (live feed)
CREATE TABLE IF NOT EXISTS ops_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES ops_agents(id),
  event_type TEXT CHECK (event_type IN ('pulse', 'think', 'chat', 'mission', 'move', 'proposal')),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  target_agent_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stage_events_created ON ops_stage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_events_agent ON ops_stage_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_insights_published ON ops_insights(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_status ON ops_radar_ideas(status);

-- Seed initial RPG stats for existing agents
UPDATE ops_agents SET 
  wisdom = CASE id 
    WHEN 'opus' THEN 85
    WHEN 'brain' THEN 95
    WHEN 'growth' THEN 70
    WHEN 'creator' THEN 75
    WHEN 'twitter-alt' THEN 60
    WHEN 'company-observer' THEN 90
    ELSE 50
  END,
  trust = CASE id 
    WHEN 'opus' THEN 90
    WHEN 'brain' THEN 85
    WHEN 'growth' THEN 75
    WHEN 'creator' THEN 80
    WHEN 'twitter-alt' THEN 65
    WHEN 'company-observer' THEN 95
    ELSE 50
  END,
  speed = CASE id 
    WHEN 'opus' THEN 70
    WHEN 'brain' THEN 60
    WHEN 'growth' THEN 90
    WHEN 'creator' THEN 85
    WHEN 'twitter-alt' THEN 95
    WHEN 'company-observer' THEN 55
    ELSE 50
  END,
  creativity = CASE id 
    WHEN 'opus' THEN 80
    WHEN 'brain' THEN 75
    WHEN 'growth' THEN 85
    WHEN 'creator' THEN 95
    WHEN 'twitter-alt' THEN 90
    WHEN 'company-observer' THEN 60
    ELSE 50
  END,
  daily_ops = FLOOR(RANDOM() * 100 + 50),
  last_sync = NOW() - (RANDOM() * INTERVAL '30 minutes'),
  affect = 'focused'
WHERE id IN ('opus', 'brain', 'growth', 'creator', 'twitter-alt', 'company-observer');

-- Seed role cards for each agent
INSERT INTO ops_role_cards (agent_id, skills, equipment_inputs, equipment_outputs, sealed_abilities, escalation_triggers)
VALUES 
  ('opus', 
   ARRAY['Strategic coordination', 'Cross-agent task delegation', 'Priority management', 'Decision synthesis'],
   ARRAY['Agent status updates', 'Mission proposals', 'Conflict alerts', 'Resource requests'],
   ARRAY['Approved missions', 'Priority rankings', 'Delegation orders', 'Status reports'],
   ARRAY['No direct code execution', 'No external API calls', 'No financial transactions'],
   ARRAY['Budget decisions > 100€', 'Public communications', 'Security-related changes']
  ),
  ('brain',
   ARRAY['Deep analysis', 'Fact verification', 'Pattern recognition', 'Research synthesis'],
   ARRAY['Raw data sources', 'Claims to verify', 'Research questions', 'Analysis requests'],
   ARRAY['Verified insights', 'Research summaries', 'Fact-check reports', 'Knowledge updates'],
   ARRAY['No speculation without evidence', 'No external publishing', 'No made-up citations'],
   ARRAY['Sensitive data handling', 'Legal/contract topics', 'Conflicting source resolution']
  ),
  ('growth',
   ARRAY['Market scanning', 'Opportunity detection', 'Trend analysis', 'Growth strategy'],
   ARRAY['Market signals', 'Competitor data', 'User feedback', 'Platform analytics'],
   ARRAY['Opportunity briefs', 'Growth recommendations', 'Market reports', 'Lead lists'],
   ARRAY['No direct outreach', 'No paid campaigns', 'No partnership commitments'],
   ARRAY['Budget allocation', 'New market entry', 'Major pivots']
  ),
  ('creator',
   ARRAY['Content creation', 'Narrative design', 'Brand voice', 'Visual direction'],
   ARRAY['Topic briefs', 'Brand guidelines', 'Reference materials', 'Feedback notes'],
   ARRAY['Draft content', 'Headlines', 'Social posts', 'Creative concepts'],
   ARRAY['No direct publishing', 'No brand changes', 'No external commitments'],
   ARRAY['Brand-sensitive content', 'Controversial topics', 'Major campaigns']
  ),
  ('twitter-alt',
   ARRAY['Social engagement', 'Viral content', 'Community building', 'Real-time response'],
   ARRAY['Trending topics', 'Engagement data', 'Content drafts', 'Community signals'],
   ARRAY['Tweet drafts', 'Engagement reports', 'Trend analysis', 'Response suggestions'],
   ARRAY['No automated posting', 'No DM outreach', 'No controversial takes'],
   ARRAY['Crisis response', 'Negative sentiment spikes', 'Viral moments']
  ),
  ('company-observer',
   ARRAY['Metrics analysis', 'Process auditing', 'Performance tracking', 'Risk detection'],
   ARRAY['System logs', 'Performance data', 'Agent activities', 'Error reports'],
   ARRAY['Health reports', 'Audit findings', 'Optimization suggestions', 'Risk alerts'],
   ARRAY['No direct interventions', 'No config changes', 'No agent modifications'],
   ARRAY['Critical errors', 'Security incidents', 'Performance degradation']
  )
ON CONFLICT (agent_id) DO UPDATE SET
  skills = EXCLUDED.skills,
  equipment_inputs = EXCLUDED.equipment_inputs,
  equipment_outputs = EXCLUDED.equipment_outputs,
  sealed_abilities = EXCLUDED.sealed_abilities,
  escalation_triggers = EXCLUDED.escalation_triggers,
  updated_at = NOW();

-- Seed some initial radar ideas
INSERT INTO ops_radar_ideas (title, description, status, progress, votes, drafted_by, source)
VALUES 
  ('Polymarket Auto-Trader', 'Automated trading bot for 15-min BTC markets with Golden Strategy', 'building', 80, 12, 'brain', 'Internal'),
  ('VoxYZ Public Dashboard', 'Public-facing dashboard showing agent activities in real-time', 'building', 60, 8, 'creator', 'Internal'),
  ('AI Content Pipeline', 'Automated blog post generation from agent insights', 'validating', 40, 5, 'creator', 'HackerNews'),
  ('Revenue Tracker Widget', 'Real-time revenue tracking toward 5k€/month goal', 'validating', 30, 3, 'company-observer', 'Internal'),
  ('Agent Delegation System', 'Allow agents to assign tasks to each other', 'watching', 10, 7, 'opus', 'Internal'),
  ('Smart Batching', 'Optimize API calls by batching similar requests', 'watching', 5, 2, 'brain', 'Internal')
ON CONFLICT DO NOTHING;

-- Seed some initial insights
INSERT INTO ops_insights (slug, title, description, type, author_agent_id, pinned)
VALUES 
  ('building-autonomous-agents-lessons', 'Building Autonomous Agents: Lessons from Week 1', 'Key insights from our first week running 6 AI agents autonomously, including coordination challenges and solutions.', 'blog_post', 'creator', true),
  ('revenue-generation-strategies', 'Revenue Generation Strategies for AI Agent Systems', 'How we are approaching the 5k€/month goal using Polymarket, freelance, and SaaS pillars.', 'insight', 'brain', false),
  ('agent-coordination-patterns', 'Agent Coordination Patterns That Actually Work', 'Practical patterns for multi-agent coordination including handoffs, escalation, and conflict resolution.', 'insight', 'opus', false)
ON CONFLICT (slug) DO NOTHING;
