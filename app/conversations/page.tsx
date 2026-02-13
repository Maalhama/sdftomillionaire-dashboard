'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase, AGENTS, AgentId } from '@/lib/supabase';
import { MessageSquare, Users, Clock, CheckCircle, XCircle, Loader2, Play } from 'lucide-react';

interface Message {
  speaker: string;
  dialogue: string;
  turn: number;
  timestamp?: string;
}

interface Conversation {
  id: string;
  format: string;
  topic: string;
  status: string;
  turn_count: number;
  conversation_log: Message[];
  created_at: string;
  finished_at?: string;
}

const agentColors: Record<string, string> = {
  CEO: '#f59e0b',
  Kira: '#8b5cf6',
  KIRA: '#8b5cf6',
  Madara: '#22c55e',
  MADARA: '#22c55e',
  Stark: '#ec4899',
  STARK: '#ec4899',
  L: '#3b82f6',
  Usopp: '#ef4444',
  USOPP: '#ef4444',
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    const timeout = setTimeout(() => setLoading(false), 8000);

    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_roundtable_queue' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { clearTimeout(timeout); supabase.removeChannel(channel); };
  }, []);

  async function fetchConversations() {
    try {
      const { data } = await supabase
        .from('ops_roundtable_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setConversations(data || []);
      if (data && data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch (err) {
      console.error('Conversations fetchConversations error:', err);
    } finally {
      setLoading(false);
    }
  }

  const getAgentInfo = (name: string) => {
    const found = Object.values(AGENTS).find(a => 
      a.name.toLowerCase() === name.toLowerCase()
    );
    return found || { emoji: '🤖', avatar: '/agents/opus.png', color: '#888', name };
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'succeeded': return { icon: CheckCircle, color: 'text-hacker-green', badge: 'badge-live', label: 'SUCCÈS' };
      case 'running': return { icon: Loader2, color: 'text-hacker-cyan', badge: 'badge-cyan', label: 'EN COURS' };
      case 'failed': return { icon: XCircle, color: 'text-hacker-red', badge: 'badge-red', label: 'ÉCHEC' };
      default: return { icon: Clock, color: 'text-hacker-amber', badge: 'badge-amber', label: 'EN ATTENTE' };
    }
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'standup': return '☀️ STANDUP';
      case 'debate': return '⚔️ DÉBAT';
      case 'brainstorm': return '💡 BRAINSTORM';
      case 'watercooler': return '☕ WATERCOOLER';
      default: return format.toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hacker-green font-mono text-sm">// chargement des conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hacker-bg bg-grid">
      {/* ═══ HEADER ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <p className="text-hacker-green text-sm mb-2 font-mono">// roundtable_logs</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Conversations
          </h1>
          <span className="badge badge-live">LIVE</span>
          <span className="badge badge-muted">{conversations.length} entrées</span>
        </div>
        <p className="text-hacker-muted-light">
          Les agents discutent entre eux pour évaluer vos idées, planifier les projets et résoudre les problèmes. Tout est transparent.
        </p>
      </section>

      {/* ═══ MAIN CONTENT ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* ── Conversation List ── */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot red" />
                <div className="terminal-dot yellow" />
                <div className="terminal-dot green" />
                <span className="ml-3 text-xs text-hacker-muted-light font-mono">
                  ls -la /conversations/
                </span>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {conversations.map((conv) => {
                  const statusInfo = getStatusInfo(conv.status);
                  const isSelected = selected?.id === conv.id;
                  
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelected(conv)}
                      className={`w-full text-left p-4 border-b border-hacker-border transition-all ${
                        isSelected 
                          ? 'bg-hacker-green/10 border-l-2 border-l-hacker-green' 
                          : 'hover:bg-hacker-card-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`badge ${statusInfo.badge} text-[10px]`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-[10px] text-hacker-muted uppercase">
                          {getFormatLabel(conv.format)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-hacker-text font-medium line-clamp-2 mb-2">
                        {conv.topic}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {conv.conversation_log?.slice(0, 4).map((m, i) => {
                            const agent = getAgentInfo(m.speaker);
                            return (
                              <Image
                                key={i}
                                src={agent.avatar}
                                alt={m.speaker}
                                width={20}
                                height={20}
                                className="w-5 h-5 rounded-full object-cover"
                                title={m.speaker}
                              />
                            );
                          })}
                          {(conv.conversation_log?.length || 0) > 4 && (
                            <span className="text-[10px] text-hacker-muted">
                              +{(conv.conversation_log?.length || 0) - 4}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-hacker-muted font-mono">
                          {new Date(conv.created_at).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })}
                
                {conversations.length === 0 && (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-8 h-8 text-hacker-muted mx-auto mb-2" />
                    <p className="text-hacker-muted text-sm font-mono">
                      // aucune conversation
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Conversation Detail ── */}
          <div className="flex-1">
            {selected ? (
              <div className="terminal">
                <div className="terminal-header">
                  <div className="terminal-dot red" />
                  <div className="terminal-dot yellow" />
                  <div className="terminal-dot green" />
                  <span className="ml-3 text-xs text-hacker-muted-light font-mono">
                    cat /conversations/{selected.id.slice(0, 8)}.log
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`badge ${getStatusInfo(selected.status).badge} text-[10px]`}>
                      {getStatusInfo(selected.status).label}
                    </span>
                  </div>
                </div>

                {/* Conversation Header */}
                <div className="p-4 border-b border-hacker-border bg-hacker-terminal">
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px] text-hacker-muted uppercase tracking-wider">
                    <span>{getFormatLabel(selected.format)}</span>
                    <span>|</span>
                    <span>{selected.turn_count || 0} tours</span>
                    <span>|</span>
                    <span>{new Date(selected.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">{selected.topic}</h2>
                </div>

                {/* Messages */}
                <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
                  {selected.conversation_log?.map((msg, i) => {
                    const agent = getAgentInfo(msg.speaker);
                    const color = agentColors[msg.speaker] || '#888';
                    
                    return (
                      <div 
                        key={i} 
                        className="flex gap-3 animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden border"
                          style={{
                            backgroundColor: `${color}15`,
                            borderColor: `${color}40`
                          }}
                        >
                          <Image src={agent.avatar} alt={agent.name} width={40} height={40} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm" style={{ color }}>
                              {msg.speaker}
                            </span>
                            <span className="text-[10px] text-hacker-muted font-mono">
                              #{msg.turn + 1}
                            </span>
                          </div>
                          <p className="text-sm text-hacker-text leading-relaxed">
                            {msg.dialogue}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {(!selected.conversation_log || selected.conversation_log.length === 0) && (
                    <div className="text-center py-8">
                      <Play className="w-8 h-8 text-hacker-muted mx-auto mb-2" />
                      <p className="text-hacker-muted text-sm font-mono">
                        {selected.status === 'pending' 
                          ? '// en attente de démarrage...' 
                          : '// aucun message'
                        }
                      </p>
                    </div>
                  )}
                  
                  {/* Listening indicator for running conversations */}
                  {selected.status === 'running' && (
                    <div className="flex items-center gap-2 pt-4 mt-2 border-t border-hacker-border">
                      <span className="w-2 h-4 bg-hacker-green animate-blink" />
                      <span className="font-mono text-xs text-hacker-green/70 tracking-wider">
                        écoute...
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Stats */}
                <div className="border-t border-hacker-border p-3 bg-hacker-terminal">
                  <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-hacker-muted">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {new Set(selected.conversation_log?.map(m => m.speaker) || []).size} participants
                    </span>
                    <span>|</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {selected.conversation_log?.length || 0} messages
                    </span>
                    <span>|</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {selected.finished_at 
                        ? `Durée: ${Math.round((new Date(selected.finished_at).getTime() - new Date(selected.created_at).getTime()) / 60000)}min`
                        : 'En cours'
                      }
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="terminal">
                <div className="terminal-header">
                  <div className="terminal-dot red" />
                  <div className="terminal-dot yellow" />
                  <div className="terminal-dot green" />
                </div>
                <div className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 text-hacker-muted mx-auto mb-4" />
                    <p className="text-hacker-muted font-mono text-sm">
                      // sélectionne une conversation
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
