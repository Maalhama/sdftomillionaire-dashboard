import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://snflassnlynlvxdpjzmu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZmxhc3NubHlubHZ4ZHBqem11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzM1MjEsImV4cCI6MjA4NjQwOTUyMX0.VZd5xgPgP2iHgZx8TCwUQR_NVHHxfWuOXEQ4Cap5VhA';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const AGENTS = {
  opus: { name: 'CEO', emoji: '🎩', role: 'Chief of Staff', color: '#f59e0b' },
  brain: { name: 'Kira', emoji: '🧠', role: 'Head of Research', color: '#8b5cf6' },
  growth: { name: 'Madara', emoji: '👁️', role: 'Growth Specialist', color: '#22c55e' },
  creator: { name: 'Stark', emoji: '🎨', role: 'Content Creator', color: '#ec4899' },
  'twitter-alt': { name: 'L', emoji: '⚡', role: 'Social Media', color: '#3b82f6' },
  'company-observer': { name: 'Usopp', emoji: '🎯', role: 'Ops Auditor', color: '#ef4444' },
};

export type AgentId = keyof typeof AGENTS;
