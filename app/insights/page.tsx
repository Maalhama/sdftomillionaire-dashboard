'use client';

import { useState, useEffect } from 'react';
import { Brain, Lightbulb, TrendingUp, Target, Zap, RefreshCw } from 'lucide-react';
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

const typeIcons: Record<string, any> = {
  insight: Lightbulb,
  pattern: TrendingUp,
  strategy: Target,
  lesson: Brain,
  preference: Zap,
};

const typeLabels: Record<string, string> = {
  insight: 'Insight',
  pattern: 'Pattern',
  strategy: 'Stratégie',
  lesson: 'Leçon',
  preference: 'Préférence',
};

interface Insight {
  id: string;
  agent_id: string;
  memory_type: string;
  content: string;
  confidence: number;
  tags: string[];
  created_at: string;
}

export default function PageInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState('all');

  const charger = async () => {
    const { data } = await supabase
      .from('ops_agent_memory')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setInsights(data);
    setLoading(false);
  };

  useEffect(() => {
    charger();
    const channel = supabase
      .channel('insights-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_agent_memory' }, (p) => {
        setInsights(prev => [p.new as Insight, ...prev.slice(0, 49)]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtres = insights.filter(i => filtre === 'all' || i.memory_type === filtre);

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg bg-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hacker-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hacker-green font-mono text-sm">Chargement insights...</p>
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
            <h1 className="text-2xl font-bold text-hacker-green">// Insights Agents</h1>
            <p className="text-sm text-hacker-muted mt-1">
              Learnings, patterns et stratégies découverts
            </p>
          </div>
          <button onClick={charger} className="btn-secondary text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'insight', 'pattern', 'strategy', 'lesson', 'preference'].map((type) => (
            <button
              key={type}
              onClick={() => setFiltre(type)}
              className={`px-3 py-1.5 rounded text-xs transition-all ${
                filtre === type
                  ? 'bg-hacker-green/20 text-hacker-green border border-hacker-green'
                  : 'bg-hacker-terminal text-hacker-muted border border-hacker-border hover:text-hacker-text'
              }`}
            >
              {type === 'all' ? '// Tous' : `// ${typeLabels[type] || type}`}
            </button>
          ))}
        </div>

        {/* Stats par type */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {['insight', 'pattern', 'strategy', 'lesson', 'preference'].map((type) => {
            const count = insights.filter(i => i.memory_type === type).length;
            const Icon = typeIcons[type] || Lightbulb;
            return (
              <div key={type} className="card-terminal p-3 text-center">
                <Icon className="w-5 h-5 mx-auto mb-1 text-hacker-green" />
                <div className="font-mono text-lg text-hacker-text">{count}</div>
                <div className="text-[10px] text-hacker-muted">{typeLabels[type]}s</div>
              </div>
            );
          })}
        </div>

        {/* Liste Insights */}
        {filtres.length === 0 ? (
          <div className="card-terminal p-10 text-center">
            <Brain className="w-10 h-10 text-hacker-muted mx-auto mb-3" />
            <p className="text-hacker-muted">Aucun insight pour le moment</p>
            <p className="text-xs text-hacker-muted-light mt-1">Les agents n'ont pas encore généré de learnings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtres.map((insight) => {
              const Icon = typeIcons[insight.memory_type] || Lightbulb;
              return (
                <div key={insight.id} className="card-terminal p-4 hover:border-hacker-green/30 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-hacker-terminal" style={{ color: agentColors[insight.agent_id] }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold" style={{ color: agentColors[insight.agent_id] }}>
                          {agentNoms[insight.agent_id] || insight.agent_id}
                        </span>
                        <span className="badge badge-muted text-[10px]">
                          {typeLabels[insight.memory_type] || insight.memory_type}
                        </span>
                        <span className="text-[10px] text-hacker-muted">
                          {Math.round(insight.confidence * 100)}% confiance
                        </span>
                      </div>
                      <p className="text-sm text-hacker-text leading-relaxed">{insight.content}</p>
                      {insight.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {insight.tags.map((tag, i) => (
                            <span key={i} className="text-[10px] text-hacker-muted bg-hacker-terminal px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-hacker-muted mt-2">
                        {new Date(insight.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-hacker-muted">
            <span className="text-hacker-green">●</span> Supabase Realtime connecté
          </p>
        </div>
      </div>
    </div>
  );
}
