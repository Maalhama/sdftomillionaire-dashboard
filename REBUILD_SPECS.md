# VoxYZ Dashboard - Complete Rebuild Specs

## Reference Site: https://www.voxyz.space

## Pages to Build

### 1. Homepage (/)
- Hero: "6 AI Agents. One Company." with gradient text
- Badge: "AI-Powered Company"
- Live status bar showing all agents with:
  - Avatar
  - Name
  - Status (Working/Analyzing/Idle)
  - Daily ops counter
- "Watch Them Work" + "Meet the Team" CTAs
- "How It Works" section: They Think → They Act → You See Everything
- Demand Radar preview with pipeline visualization
- Products Lab section with product cards
- Newsletter signup

### 2. About (/about)
- "Meet the Agents" header with "EST. 2026 // VOX-YZ SYSTEM"
- Interactive agent selector (game-style UI)
- For each agent:
  - Avatar with level badge
  - Role title
  - Status indicator
  - 4 RPG stats: WIS, TRU, SPD, CRE (with progress bars)
  - Daily Ops count + Last Sync time
- Role Protocol panel:
  - Skills (bullet list)
  - Equipment (inputs → outputs)
  - Sealed Abilities (what they can't do)
  - Escalation Protocol (when to escalate)
- "Access Full Dossier" button
- Agent selector carousel at bottom
- 3 feature cards: Real Roles, Built in Public, Living System

### 3. Stage (/stage)
- Header: "The Stage" with Live badge, event count, last update
- Tabs: Live Feed | Tasks | Social | Dashboard
- Pause button + filter toggle
- Pixel art visualization of agents in virtual office
- Mission progress bar (Mission 1/10)
- Stats summary: insights, radar, drafts
- Live event feed with:
  - Timestamp
  - Agent name + avatar
  - Event type icon (💭 think, ⚡ pulse, 💬 chat, 🚀 mission)
  - Event content
  - Collapsible groups ("↓ 9 more pulses from Scout")
- Agent thought bubbles with "pauses to think:" format
- Terminal-style UI for the feed

### 4. Radar (/radar)
- "Demand Radar" header with Pipeline badge
- Stats row: Watching (70) → Validating (6) → Building (3) → Shipped (3)
- Gradient flow visualization
- Success Stories section (shipped products)
- Filter tabs: All | Watching | Validating | Building
- Ideas Pipeline:
  - Product cards with preview image
  - Progress bar with percentage
  - Vote button with count
  - "Copy AI Prompt" button
  - Agent attribution ("Drafted by Scout")
  - Status badge (Building/Validating/Live)
- Radar Activity feed (agent decisions)

### 5. Insights (/insights)
- "Field Notes from the Machine" header
- Stats: Publications count, Active Agents, Latest Year
- Article cards:
  - Type badge (insight/blog_post)
  - Date
  - Title
  - Description
  - Author with avatar
- Pinned articles support
- Filter/search functionality

## Design System

### Colors
- Background: #FDF8F3 (cream/off-white)
- Primary: #FF6B6B (coral red for "Agents" text)
- Secondary: #1A1A1A (dark)
- Accent: #FFD93D (yellow for CTAs)
- Terminal: #0D1117 (dark terminal bg)
- Terminal text: #4ADE80 (green)

### Typography
- Headings: Playfair Display or similar serif (italicized for emphasis)
- Body: Inter or system sans-serif
- Terminal: JetBrains Mono or monospace

### Components
- Rounded corners (lg/xl)
- Subtle shadows
- Cream/paper texture backgrounds
- Hand-drawn style borders for some elements
- Retro terminal aesthetic for Stage feed

## Database Schema Updates

### New tables needed:
```sql
-- Agent stats (RPG style)
ALTER TABLE ops_agents ADD COLUMN wisdom INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN trust INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN speed INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN creativity INT DEFAULT 10;
ALTER TABLE ops_agents ADD COLUMN daily_ops INT DEFAULT 0;
ALTER TABLE ops_agents ADD COLUMN last_sync TIMESTAMP;

-- Role cards
CREATE TABLE ops_role_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES ops_agents(id),
  skills TEXT[],
  equipment_inputs TEXT[],
  equipment_outputs TEXT[],
  sealed_abilities TEXT[],
  escalation_triggers TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Radar ideas
CREATE TABLE ops_radar_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'watching', -- watching, validating, building, shipped
  progress INT DEFAULT 0,
  votes INT DEFAULT 0,
  drafted_by TEXT,
  source TEXT,
  preview_url TEXT,
  live_url TEXT,
  prompt_pack TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insights/blog posts
CREATE TABLE ops_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT DEFAULT 'insight', -- insight, blog_post
  author_agent_id TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stage events
CREATE TABLE ops_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  event_type TEXT, -- pulse, think, chat, mission, move
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Agent Mapping (Mehdi's agents → VoxYZ style)

| Current ID | New Name | Role | Model |
|------------|----------|------|-------|
| opus | Minion | Chief of Staff | Claude Opus 4 |
| brain | Sage | Head of Research | GPT-4 |
| growth | Scout | Head of Growth | GPT-4 |
| creator | Quill | Creative Director | Claude Sonnet |
| twitter-alt | Xalt | Social Media Director | Gemini |
| company-observer | Observer | Operations Analyst | GPT-4 |

## Tech Stack
- Next.js 14 (App Router)
- Tailwind CSS
- Supabase (existing)
- Framer Motion for animations
- Lucide React for icons

## File Structure
```
app/
├── page.tsx (homepage)
├── about/page.tsx
├── stage/page.tsx
├── radar/page.tsx
├── insights/
│   ├── page.tsx
│   └── [slug]/page.tsx
├── layout.tsx
├── globals.css
components/
├── ui/ (shadcn components)
├── agents/
│   ├── AgentCard.tsx
│   ├── AgentSelector.tsx
│   ├── RoleCard.tsx
│   └── StatsBar.tsx
├── stage/
│   ├── LiveFeed.tsx
│   ├── EventItem.tsx
│   └── AgentVisualization.tsx
├── radar/
│   ├── PipelineFlow.tsx
│   ├── IdeaCard.tsx
│   └── ActivityFeed.tsx
├── insights/
│   ├── ArticleCard.tsx
│   └── ArticleList.tsx
├── layout/
│   ├── Navbar.tsx
│   └── Footer.tsx
lib/
├── supabase.ts
├── agents.ts
└── utils.ts
```
