'use client';

import { useState, useEffect } from 'react';
import { Radar, AlertTriangle, Target, Zap, RefreshCw, Clock, DollarSign } from 'lucide-react';
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

interface Proposition {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  created_at: string;
}

interface Mission {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
}

export default function PageRadar() {
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  const charger = async () => {
    const [{ data: props }, { data: miss }] = await Promise.all([
      supabase.from('ops_mission_proposals').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('ops_missions').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (props) setPropositions(props);
    if (miss) setMissions(miss);
    setLoading(false);
  };

  const accepter = async (id: string) => {
    await supabase.from('ops_mission_proposals').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('id', id);
    setPropositions(prev => prev.map(p => p.id === id ? { ...p, status: 'accepted' } : p));
  };

  const rejeter = async (id: string) => {
    await supabase.from('ops_mission_proposals').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
    setPropositions(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
  };

  useEffect(() => {
    charger();
    const channel = supabase
      .channel('radar-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_mission_proposals' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_missions' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const enAttente = propositions.filter(p => p.status === 'pending');
  const acceptees = propositions.filter(p => p.status === 'accepted');
  const actives = missions.filter(m => m.status === 'running' || m.status === 'approved');

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hacker-green font-mono text-sm">Scan des opportunités...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-hacker-green flex items-center gap-2">
              <Radar className="w-6 h-6" />
              // Radar Opportunités
            </h1>
            <p className="text-sm text-hacker-muted mt-1">
              Propositions et idées business détectées par les agents
            </p>
          </div>
          <button onClick={charger} className="btn-secondary text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Scanner
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card-terminal p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-hacker-amber" />
            <div className="font-mono text-xl text-hacker-amber">{enAttente.length}</div>
            <div className="text-[10px] text-hacker-muted">En attente</div>
          </div>
          <div className="card-terminal p-4 text-center">
            <Target className="w-5 h-5 mx-auto mb-2 text-hacker-green" />
            <div className="font-mono text-xl text-hacker-green">{acceptees.length}</div>
            <div className="text-[10px] text-hacker-muted">Acceptées</div>
          </div>
          <div className="card-terminal p-4 text-center">
            <Zap className="w-5 h-5 mx-auto mb-2 text-hacker-cyan" />
            <div className="font-mono text-xl text-hacker-cyan">{actives.length}</div>
            <div className="text-[10px] text-hacker-muted">En cours</div>
          </div>
          <div className="card-terminal p-4 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-2 text-hacker-text" />
            <div className="font-mono text-xl text-hacker-text">{propositions.length}</div>
            <div className="text-[10px] text-hacker-muted">Total idées</div>
          </div>
        </div>

        {/* Propositions en attente */}
        {enAttente.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-mono text-hacker-amber mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              // propositions_en_attente ({enAttente.length})
            </h2>
            <div className="space-y-3">
              {enAttente.map((prop) => (
                <div key={prop.id} className="card-terminal p-4 border-l-4 border-l-hacker-amber">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold" style={{ color: agentColors[prop.agent_id] }}>
                          {agentNoms[prop.agent_id] || prop.agent_id}
                        </span>
                        <span className="badge badge-muted text-[10px]">P{prop.priority}/10</span>
                      </div>
                      <h3 className="text-sm font-bold text-hacker-text mb-1">{prop.title}</h3>
                      {prop.description && (
                        <p className="text-xs text-hacker-muted">{prop.description}</p>
                      )}
                      <div className="text-[10px] text-hacker-muted mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(prop.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => accepter(prop.id)}
                        className="px-3 py-1 bg-hacker-green/20 text-hacker-green border border-hacker-green rounded text-xs hover:bg-hacker-green/30"
                      >
                        ✓ Accepter
                      </button>
                      <button
                        onClick={() => rejeter(prop.id)}
                        className="px-3 py-1 bg-hacker-red/20 text-hacker-red border border-hacker-red rounded text-xs hover:bg-hacker-red/30"
                      >
                        ✗ Rejeter
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toutes les propositions */}
        <div className="mb-8">
          <h2 className="text-sm font-mono text-hacker-green mb-4">
            // toutes_propositions ({propositions.length})
          </h2>
          {propositions.length === 0 ? (
            <div className="card-terminal p-10 text-center">
              <Radar className="w-10 h-10 text-hacker-muted mx-auto mb-3 animate-pulse" />
              <p className="text-hacker-muted">Radar en attente...</p>
              <p className="text-xs text-hacker-muted-light mt-1">Les agents scannent les opportunités</p>
            </div>
          ) : (
            <div className="space-y-2">
              {propositions.map((prop) => (
                <div key={prop.id} className="card-terminal p-3 hover:border-hacker-green/30 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={{ color: agentColors[prop.agent_id] }}>
                      {agentNoms[prop.agent_id]}
                    </span>
                    <span className={`text-[10px] ${
                      prop.status === 'pending' ? 'text-hacker-amber' :
                      prop.status === 'accepted' ? 'text-hacker-green' :
                      'text-hacker-red'
                    }`}>
                      [{prop.status.toUpperCase()}]
                    </span>
                    <span className="text-sm text-hacker-text flex-1">{prop.title}</span>
                    <span className="text-[10px] text-hacker-muted">P{prop.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missions actives */}
        {actives.length > 0 && (
          <div>
            <h2 className="text-sm font-mono text-hacker-cyan mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              // missions_actives ({actives.length})
            </h2>
            <div className="space-y-2">
              {actives.map((mission) => (
                <div key={mission.id} className="card-terminal p-3 border-l-4 border-l-hacker-cyan">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-hacker-cyan animate-pulse" />
                    <span className="text-sm text-hacker-text">{mission.title}</span>
                  </div>
                  {mission.description && (
                    <p className="text-xs text-hacker-muted mt-1">{mission.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-hacker-muted">
            <span className="text-hacker-green">●</span> Supabase Realtime — Radar actif
          </p>
        </div>
      </div>
    </div>
  );
}
