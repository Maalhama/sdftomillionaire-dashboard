import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://snflassnlynlvxdpjzmu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZmxhc3NubHlubHZ4ZHBqem11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzM1MjEsImV4cCI6MjA4NjQwOTUyMX0.9CEmIJXqjdx_hz513BAhReYl-pHX9MLQLT6fDn326mo';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const AGENTS = {
  opus: { name: 'CEO', emoji: '🎩', avatar: '/agents/opus.png', role: 'Chef des Opérations', color: '#f59e0b' },
  brain: { name: 'Kira', emoji: '🧠', avatar: '/agents/brain.png', role: 'Chef de Recherche', color: '#8b5cf6' },
  growth: { name: 'Madara', emoji: '👁️', avatar: '/agents/growth.png', role: 'Spécialiste Croissance', color: '#22c55e' },
  creator: { name: 'Stark', emoji: '🎨', avatar: '/agents/creator.jpg', role: 'Directeur Créatif', color: '#ec4899' },
  'twitter-alt': { name: 'L', emoji: '⚡', avatar: '/agents/twitter-alt.png', role: 'Directeur Réseaux Sociaux', color: '#3b82f6' },
  'company-observer': { name: 'Usopp', emoji: '🎯', avatar: '/agents/company-observer.jpg', role: 'Auditeur Opérations', color: '#ef4444' },
};

export type AgentId = keyof typeof AGENTS;
