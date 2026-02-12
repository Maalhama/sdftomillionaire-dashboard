'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, Clock } from 'lucide-react';
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

interface Conversation {
  id: string;
  format: string;
  topic: string;
  participants: string[];
  status: string;
  turn_count: number;
  conversation_log: Array<{
    speaker: string;
    dialogue?: string;
    message?: string;
    turn: number;
  }>;
  created_at: string;
}

export default function PageConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  const charger = async () => {
    const { data } = await supabase
      .from('ops_roundtable_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setConversations(data);
      if (!selected && data.length > 0) setSelected(data[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    charger();
    const channel = supabase
      .channel('conversations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_roundtable_queue' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hacker-green font-mono text-sm">Chargement conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hacker-green flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              // Conversations
            </h1>
            <p className="text-sm text-hacker-muted mt-1">
              Échanges et débats entre les agents
            </p>
          </div>
          <button onClick={charger} className="btn-secondary text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="card-terminal p-10 text-center">
            <MessageSquare className="w-10 h-10 text-hacker-muted mx-auto mb-3" />
            <p className="text-hacker-muted">Aucune conversation</p>
            <p className="text-xs text-hacker-muted-light mt-1">Les agents n'ont pas encore échangé</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Liste conversations */}
            <div className="space-y-2">
              <p className="text-xs text-hacker-muted font-mono mb-2">// liste ({conversations.length})</p>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left p-3 rounded border transition-all ${
                    selected?.id === conv.id
                      ? 'border-hacker-green bg-hacker-terminal'
                      : 'border-hacker-border bg-hacker-bg hover:border-hacker-green/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${
                      conv.status === 'running' ? 'text-hacker-green' :
                      conv.status === 'succeeded' ? 'text-hacker-cyan' :
                      'text-hacker-muted'
                    }`}>
                      [{conv.status.toUpperCase()}]
                    </span>
                    <span className="text-[10px] text-hacker-muted">{conv.turn_count} tours</span>
                  </div>
                  <p className="text-sm text-hacker-text line-clamp-2">{conv.topic}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {conv.participants.slice(0, 3).map((p) => (
                      <span key={p} className="text-[10px]" style={{ color: agentColors[p] }}>
                        {agentNoms[p]}
                      </span>
                    ))}
                    {conv.participants.length > 3 && (
                      <span className="text-[10px] text-hacker-muted">+{conv.participants.length - 3}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Détail conversation */}
            <div className="lg:col-span-2">
              {selected ? (
                <div className="terminal h-full">
                  <div className="terminal-header">
                    <div className="terminal-dot red" />
                    <div className="terminal-dot yellow" />
                    <div className="terminal-dot green" />
                    <span className="text-xs text-hacker-muted ml-3 font-mono">
                      roundtable --format={selected.format}
                    </span>
                    <span className={`ml-auto badge ${
                      selected.status === 'running' ? 'badge-live' : 'badge-muted'
                    } text-[10px]`}>
                      {selected.status === 'running' ? '🔴 Live' : selected.status}
                    </span>
                  </div>

                  <div className="p-4 max-h-[500px] overflow-y-auto">
                    <div className="mb-4 pb-3 border-b border-hacker-border">
                      <p className="text-sm text-hacker-amber font-bold mb-2">💬 {selected.topic}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {selected.participants.map((p) => (
                          <span key={p} className="badge badge-muted" style={{ color: agentColors[p] }}>
                            {agentNoms[p] || p}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-hacker-muted mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(selected.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selected.conversation_log?.map((tour, idx) => (
                        <div key={idx} className="font-mono text-sm">
                          <span className="text-hacker-muted">[{idx + 1}]</span>{' '}
                          <span style={{ color: agentColors[tour.speaker] }} className="font-bold">
                            {agentNoms[tour.speaker] || tour.speaker}:
                          </span>{' '}
                          <span className="text-hacker-text">{tour.dialogue || tour.message}</span>
                        </div>
                      ))}
                      {selected.status === 'running' && (
                        <div className="font-mono text-sm text-hacker-green animate-pulse">
                          ▋ en cours...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-terminal p-10 text-center">
                  <p className="text-hacker-muted">Sélectionnez une conversation</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
