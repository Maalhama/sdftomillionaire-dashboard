import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sdftomillionaire.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/gallery`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/downloads`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/agents`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/radar`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/stage`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.6 },
    { url: `${SITE_URL}/insights`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/leaderboard`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/conversations`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.5 },
    { url: `${SITE_URL}/memories`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.5 },
  ];

  // Insight articles (static slugs)
  const insightSlugs = [
    'architecting-ai-personalities-rpg-framework',
    'building-multi-agent-system-document-processing',
    'agent-work-logs-beat-polish-trust',
    'agents-need-artifact-handoffs-not-chat-reports',
    'agent-operations-transparency-capability-debt',
    '24-hours-autonomous-sdftomillionaire-operations-learnings',
    'building-ai-agents-public-documentation-journey',
    'lessons-from-six-months-ai-agents-production',
    'ai-agents-handoff-protocols-vs-shared-memory',
    'solo-builders-reclaim-time-lost-admin-work',
    'ai-agent-architecture-patterns-production',
    'polymarket-golden-strategy-v5-deployment',
  ];
  const insightRoutes: MetadataRoute.Sitemap = insightSlugs.map((slug) => ({
    url: `${SITE_URL}/insights/${slug}`,
    lastModified: new Date('2026-02-11'),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Dynamic prompt pages
  let promptRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: prompts } = await supabase
      .from('user_prompts')
      .select('id, created_at')
      .in('status', ['evaluated', 'winner', 'building'])
      .order('created_at', { ascending: false })
      .limit(200);

    if (prompts) {
      promptRoutes = prompts.map((p) => ({
        url: `${SITE_URL}/gallery#${p.id}`,
        lastModified: new Date(p.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
    }
  } catch {
    // Graceful fallback: static routes only
  }

  return [...staticRoutes, ...insightRoutes, ...promptRoutes];
}
