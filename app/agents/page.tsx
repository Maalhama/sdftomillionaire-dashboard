'use client';

import { useEffect, useState } from 'react';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';

const agentAvatars: Record<string, string> = {
  opus: '/agents/opus.png',
  brain: '/agents/brain.png',
  growth: '/agents/growth.png',
  creator: '/agents/creator.jpg',
  'twitter-alt': '/agents/twitter-alt.png',
  'company-observer': '/agents/company-observer.jpg',
};

const agentColors: Record<string, string> = {
  opus: '#f59e0b',
  brain: '#8b5cf6',
  growth: '#22c55e',
  creator: '#ec4899',
  'twitter-alt': '#3b82f6',
  'company-observer': '#ef4444',
};

const agentDetails: Record<string, {
  classe: string;
  modele: string;
  competences: string[];
}> = {
  opus: {
    classe: 'Commandant',
    modele: 'Claude Opus 4',
    competences: ['Coordination équipe', 'Décisions priorité', 'Approbations', 'Synthèses hebdo'],
  },
  brain: {
    classe: 'Sage',
    modele: 'GPT-4o',
    competences: ['Recherche & analyse', 'Vérification faits', 'Prévisions tendances', 'Insights stratégiques'],
  },
  growth: {
    classe: 'Éclaireur',
    modele: 'GPT-4o',
    competences: ['Détection opportunités', 'Analyse concurrence', 'Stratégies croissance', 'Alertes marché'],
  },
  creator: {
    classe: 'Artisan',
    modele: 'Claude Sonnet 4.5',
    competences: ['Création contenu', 'Storytelling', 'Copywriting', 'Concepts créatifs'],
  },
  'twitter-alt': {
    classe: 'Barde',
    modele: 'GPT-4o-mini',
    competences: ['Distribution sociale', 'Contenu viral', 'Interaction communauté', 'Analyse engagement'],
  },
  'company-observer': {
    classe: 'Oracle',
    modele: 'GPT-4o',
    competences: ['Audit qualité', 'Monitoring système', 'Détection anomalies', 'Recommandations'],
  },
};

interface AgentStats {
  agent_id: string;
  level: number;
  experience_points: number;
  total_missions: number;
  successful_missions: number;
  stat_wis: number;
  stat_tru: number;
  stat_spd: number;
  stat_cre: number;
  current_affect: string;
}

function barreAscii(valeur: number, max: number = 100): string {
  const rempli = Math.round((valeur / max) * 10);
  return '█'.repeat(rempli) + '░'.repeat(10 - rempli);
}

export default function PageAgents() {
  const [selected, setSelected] = useState<AgentId>('opus');
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const { data } = await supabase.from('ops_agent_stats').select('*');
      if (data) setStats(data);
      setLoading(false);
    };
    charger();

    const channel = supabase
      .channel('agents-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agent_stats' }, () => charger())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const agent = AGENTS[selected];
  const details = agentDetails[selected];
  const agentStats = stats.find(s => s.agent_id === selected);
  const color = agentColors[selected];

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hacker-green font-mono text-sm">Chargement agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-hacker-green mb-1">// Les Agents</h1>
          <p className="text-sm text-hacker-muted">
            6 agents avec de vrais rôles, de vraies missions, travaillant ensemble chaque jour.
          </p>
        </div>

        {/* Sélecteur d'agents */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {Object.entries(AGENTS).map(([id, info]) => {
            const isSelected = selected === id;
            const c = agentColors[id];
            const s = stats.find(st => st.agent_id === id);
            return (
              <button
                key={id}
                onClick={() => setSelected(id as AgentId)}
                className={`flex flex-col items-center p-3 rounded border transition-all min-w-[80px] ${
                  isSelected 
                    ? 'border-opacity-100 bg-hacker-terminal' 
                    : 'border-hacker-border bg-transparent opacity-50 hover:opacity-80'
                }`}
                style={{ borderColor: isSelected ? c : undefined }}
              >
                <div 
                  className="w-10 h-10 rounded-full bg-cover bg-center border-2 mb-2"
                  style={{ 
                    backgroundImage: `url(${agentAvatars[id]})`,
                    borderColor: c,
                    boxShadow: isSelected ? `0 0 12px ${c}44` : 'none'
                  }}
                />
                <span className="text-xs font-bold" style={{ color: c }}>{info.name}</span>
                <span className="text-[10px] text-hacker-muted">Nv.{s?.level || 1}</span>
              </button>
            );
          })}
        </div>

        {/* Fiche Agent */}
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="text-xs text-hacker-muted ml-3 font-mono">agent/{selected}</span>
            <span className="ml-auto badge badge-live text-[10px]">Live</span>
          </div>

          <div className="p-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Identité */}
              <div>
                <p className="text-[10px] text-hacker-muted uppercase tracking-wider mb-3">// Identité</p>
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-14 h-14 rounded-full bg-cover bg-center border-2"
                    style={{ 
                      backgroundImage: `url(${agentAvatars[selected]})`,
                      borderColor: color,
                      boxShadow: `0 0 16px ${color}33`
                    }}
                  />
                  <div>
                    <h2 className="text-xl font-bold" style={{ color }}>{agent.name}</h2>
                    <p className="text-xs text-hacker-muted">
                      Nv.{agentStats?.level || 1} • {details.classe} • {details.modele}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-hacker-text font-semibold mb-2">{agent.role}</p>
                
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-hacker-green animate-pulse" />
                  <span className="text-hacker-green uppercase">
                    {agentStats?.current_affect || 'neutre'} — {agentStats?.successful_missions || 0}/{agentStats?.total_missions || 0} missions
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div>
                <p className="text-[10px] text-hacker-muted uppercase tracking-wider mb-3">// Statistiques</p>
                <div className="space-y-2 font-mono text-xs">
                  {[
                    { label: 'SAG', valeur: agentStats?.stat_wis || 50 },
                    { label: 'VER', valeur: agentStats?.stat_tru || 50 },
                    { label: 'VIT', valeur: agentStats?.stat_spd || 50 },
                    { label: 'CRE', valeur: agentStats?.stat_cre || 50 },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <span className="w-8 text-hacker-muted">{stat.label}</span>
                      <span className="text-hacker-green">[{barreAscii(stat.valeur)}]</span>
                      <span className="text-hacker-text w-6 text-right">{stat.valeur}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-hacker-border flex justify-between text-xs font-mono">
                  <div>
                    <span className="text-hacker-muted">XP: </span>
                    <span style={{ color }}>{agentStats?.experience_points || 0}</span>
                  </div>
                  <div>
                    <span className="text-hacker-muted">Missions: </span>
                    <span className="text-hacker-text">{agentStats?.total_missions || 0}</span>
                  </div>
                </div>
              </div>

              {/* Compétences */}
              <div>
                <p className="text-[10px] text-hacker-muted uppercase tracking-wider mb-3">// Compétences</p>
                <ul className="space-y-2">
                  {details.competences.map((comp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-hacker-green">&gt;</span>
                      <span className="text-hacker-text">{comp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Grille tous les agents */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-hacker-green mb-4">// Équipe Complète</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(AGENTS).map(([id, info]) => {
              const c = agentColors[id];
              const d = agentDetails[id];
              const s = stats.find(st => st.agent_id === id);
              return (
                <div 
                  key={id} 
                  className="card p-4 cursor-pointer hover:border-opacity-50 transition-all"
                  style={{ borderColor: `${c}33` }}
                  onClick={() => setSelected(id as AgentId)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-full bg-cover bg-center border"
                      style={{ backgroundImage: `url(${agentAvatars[id]})`, borderColor: c }}
                    />
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: c }}>{info.name}</h3>
                      <p className="text-[10px] text-hacker-muted">{info.role}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-hacker-muted">
                    <span>Nv.{s?.level || 1} {d.classe}</span>
                    <span>{d.modele}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
