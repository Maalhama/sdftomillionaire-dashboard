'use client';

import { useEffect, useState } from 'react';
import { supabase, AGENTS } from '@/lib/supabase';

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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_roundtable_queue' }, () => {
        fetchConversations();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchConversations() {
    const { data } = await supabase
      .from('ops_roundtable_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    setConversations(data || []);
    if (data && data.length > 0 && !selected) {
      setSelected(data[0]);
    }
    setLoading(false);
  }

  const getAgentInfo = (name: string) => {
    return Object.values(AGENTS).find(a => a.name === name) || { emoji: '🤖', color: '#888' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-sdftomillionaire-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Conversation List */}
      <div className="w-80 flex-shrink-0 overflow-y-auto">
        <h1 className="text-xl font-bold mb-4">Conversations</h1>
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                selected?.id === conv.id
                  ? 'bg-sdftomillionaire-accent/20 border-sdftomillionaire-accent'
                  : 'bg-sdftomillionaire-card border-sdftomillionaire-border hover:border-sdftomillionaire-accent/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${
                  conv.status === 'succeeded' ? 'bg-green-500' :
                  conv.status === 'running' ? 'bg-blue-500 animate-pulse' :
                  conv.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></span>
                <span className="text-xs text-gray-500 uppercase">{conv.format}</span>
              </div>
              <p className="text-sm font-medium line-clamp-2">{conv.topic}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-1">
                  {conv.conversation_log?.slice(0, 4).map((m, i) => {
                    const agent = getAgentInfo(m.speaker);
                    return <span key={i} className="text-sm">{agent.emoji}</span>;
                  })}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(conv.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Detail */}
      <div className="flex-1 bg-sdftomillionaire-card border border-sdftomillionaire-border rounded-xl overflow-hidden">
        {selected ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-sdftomillionaire-border">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 uppercase">{selected.format}</span>
                <span className="text-xs text-gray-600">•</span>
                <span className="text-xs text-gray-500">{selected.turn_count || 0} tours</span>
                <span className="text-xs text-gray-600">•</span>
                <span className={`text-xs ${
                  selected.status === 'succeeded' ? 'text-green-500' :
                  selected.status === 'running' ? 'text-blue-500' :
                  selected.status === 'failed' ? 'text-red-500' : 'text-yellow-500'
                }`}>{selected.status}</span>
              </div>
              <h2 className="text-lg font-semibold">{selected.topic}</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selected.conversation_log?.map((msg, i) => {
                const agent = getAgentInfo(msg.speaker);
                return (
                  <div key={i} className="flex gap-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <div 
                      className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${agent.color}20` }}
                    >
                      {agent.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold" style={{ color: agent.color }}>{msg.speaker}</span>
                        <span className="text-xs text-gray-500">#{msg.turn + 1}</span>
                      </div>
                      <p className="text-gray-300">{msg.dialogue}</p>
                    </div>
                  </div>
                );
              })}
              {(!selected.conversation_log || selected.conversation_log.length === 0) && (
                <p className="text-gray-500 text-center py-8">
                  {selected.status === 'pending' ? 'En attente...' : 'Aucun message'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Sélectionne une conversation
          </div>
        )}
      </div>
    </div>
  );
}
