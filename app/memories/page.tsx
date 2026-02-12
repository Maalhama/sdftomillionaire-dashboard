'use client';

import { useState, useEffect } from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const agentNoms: Record<string, string> = {
  opus: 'CEO',
  brain: 'Kira',
  growth: 'Madara',
  creator: 'Stark',
  'twitter-alt': 'L',
  'company-observer': 'Usopp',
};

const agentColors: Record<string, string> = {
  opus: '#f59e0b',
  brain: '#8b5cf6',
  growth: '#22c55e',
  creator: '#ec4899',
  'twitter-alt': '#3b82f6',
  'company-observer': '#ef4444',
};

interface Memory {
  id: string;
  agent_id: string;
  memory_type: string;
  content: string;
  confidence: number;
  status: string;
  created_at: string;
}

export default function PageMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFiltre, setAgentFiltre] = useState('all');

  const charger = async () => {
    const { data } = await supabase
      .from('ops_agent_memory')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setMemories(data);
    setLoading(false);
  };

  useEffect(() => {
    charger();
    const channel = supabase
      .channel('memories-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agent_memory' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtrees = agentFiltre === 'all' 
    ? memories 
    : memories.filter(m => m.agent_id === agentFiltre);

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hacker-green font-mono text-sm">Chargement mémoires...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hacker-green flex items-center gap-2">
              <Brain className="w-6 h-6" />
              // Mémoires Agents
            </h1>
            <p className="text-sm text-hacker-muted mt-1">
              Ce que les agents ont appris et retenu
            </p>
          </div>
          <button onClick={charger} className="btn-secondary text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        </div>

        {/* Filtres par agent */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setAgentFiltre('all')}
            className={`px-3 py-1.5 rounded text-xs transition-all ${
              agentFiltre === 'all'
                ? 'bg-hacker-green/20 text-hacker-green border border-hacker-green'
                : 'bg-hacker-terminal text-hacker-muted border border-hacker-border'
            }`}
          >
            Tous
          </button>
          {Object.entries(agentNoms).map(([id, nom]) => (
            <button
              key={id}
              onClick={() => setAgentFiltre(id)}
              className={`px-3 py-1.5 rounded text-xs transition-all ${
                agentFiltre === id
                  ? 'bg-hacker-green/20 border'
                  : 'bg-hacker-terminal border border-hacker-border'
              }`}
              style={{ 
                color: agentFiltre === id ? agentColors[id] : undefined,
                borderColor: agentFiltre === id ? agentColors[id] : undefined
              }}
            >
              {nom}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
          {Object.entries(agentNoms).map(([id, nom]) => {
            const count = memories.filter(m => m.agent_id === id).length;
            return (
              <div key={id} className="card-terminal p-3 text-center">
                <div className="font-mono text-lg" style={{ color: agentColors[id] }}>{count}</div>
                <div className="text-[10px] text-hacker-muted">{nom}</div>
              </div>
            );
          })}
        </div>

        {/* Liste */}
        {filtrees.length === 0 ? (
          <div className="card-terminal p-10 text-center">
            <Brain className="w-10 h-10 text-hacker-muted mx-auto mb-3" />
            <p className="text-hacker-muted">Aucune mémoire enregistrée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrees.map((mem) => (
              <div key={mem.id} className="card-terminal p-3 hover:border-hacker-green/30 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold shrink-0" style={{ color: agentColors[mem.agent_id] }}>
                    {agentNoms[mem.agent_id]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-hacker-text">{mem.content}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-hacker-muted">
                      <span>{mem.memory_type}</span>
                      <span>{Math.round(mem.confidence * 100)}%</span>
                      <span>{new Date(mem.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
