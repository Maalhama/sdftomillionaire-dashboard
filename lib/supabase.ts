import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return (_supabase as unknown as Record<string, unknown>)[prop as string];
  },
});

export const AGENTS = {
  opus: { name: 'CEO', emoji: '🎩', avatar: '/agents/opus.png', role: 'Chef des Opérations', color: '#f59e0b' },
  brain: { name: 'Kira', emoji: '🧠', avatar: '/agents/brain.png', role: 'Chef de Recherche', color: '#8b5cf6' },
  growth: { name: 'Madara', emoji: '👁️', avatar: '/agents/growth.png', role: 'Spécialiste Croissance', color: '#22c55e' },
  creator: { name: 'Stark', emoji: '🎨', avatar: '/agents/creator.jpg', role: 'Directeur Créatif', color: '#ec4899' },
  'twitter-alt': { name: 'L', emoji: '⚡', avatar: '/agents/twitter-alt.png', role: 'Directeur Réseaux Sociaux', color: '#3b82f6' },
  'company-observer': { name: 'Usopp', emoji: '🎯', avatar: '/agents/company-observer.jpg', role: 'Auditeur Opérations', color: '#ef4444' },
};

export type AgentId = keyof typeof AGENTS;
