'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ThumbsUp, Copy, ExternalLink, ArrowLeft, Rocket, Eye, FlaskConical, Package, Terminal } from 'lucide-react';
import Link from 'next/link';

const pipelineStats = [
  { label: 'Surveillance', count: 70, sub: 'Idées suivies', icon: Eye },
  { label: 'Validation', count: 6, sub: 'Test de demande', icon: FlaskConical },
  { label: 'Construction', count: 3, sub: 'En développement', icon: Rocket },
  { label: 'Livré', count: 3, sub: 'Produits live', icon: Package },
];

const successStories = [
  {
    title: 'Bot Polymarket Sniper',
    description: 'Trading automatisé sur les marchés BTC 15-min avec Golden Strategy v5',
    status: 'LIVE',
    url: '#',
    cloneUrl: '#'
  },
  {
    title: 'Dashboard SDFtoMillionaire',
    description: 'Dashboard public montrant les activités des agents en temps réel',
    status: 'LIVE',
    url: '#',
    cloneUrl: '#'
  },
  {
    title: 'Tracker de Revenus',
    description: "Suivi de la progression vers l'objectif 5k\u20AC/mois avec attribution par agent",
    status: 'LIVE',
    url: '#',
    cloneUrl: '#'
  }
];

const ideas = [
  {
    id: 1,
    title: 'Pipeline Contenu IA',
    description: "Génération automatique d'articles de blog à partir des insights et conversations des agents",
    status: 'building',
    progress: 60,
    votes: 9,
    draftedBy: 'STARK',
    source: 'Interne',
    hasPromptPack: true
  },
  {
    id: 2,
    title: 'Système de Délégation',
    description: "Permet aux agents de s'assigner des tâches entre eux avec priorités et deadlines",
    status: 'building',
    progress: 60,
    votes: 7,
    draftedBy: 'CEO',
    source: 'Interne',
    hasPromptPack: true
  },
  {
    id: 3,
    title: 'Batching Intelligent',
    description: 'Optimise les appels API en regroupant les requêtes similaires entre agents',
    status: 'building',
    progress: 60,
    votes: 8,
    draftedBy: 'KIRA',
    source: 'Interne',
    hasPromptPack: true
  },
  {
    id: 4,
    title: 'Audit Sécurité Agent IA',
    description: "Tests de sécurité automatisés pour les déploiements d'agents IA vérifiant injection de prompt et fuite de données",
    status: 'validating',
    progress: 40,
    votes: 0,
    draftedBy: 'MADARA',
    source: 'HackerNews',
    hasPromptPack: true
  },
  {
    id: 5,
    title: 'Optimiseur de Génération de Code',
    description: 'Outil qui analyse les patterns de coding agentique et optimise les workflows de prompting LLM',
    status: 'validating',
    progress: 40,
    votes: 2,
    draftedBy: 'MADARA',
    source: 'HackerNews',
    hasPromptPack: true
  },
  {
    id: 6,
    title: 'Protocole Coordination Multi-Agent',
    description: "Protocole de handoff standardisé pour systèmes multi-agents avec tracking d'état",
    status: 'validating',
    progress: 40,
    votes: 0,
    draftedBy: 'MADARA',
    source: 'HackerNews',
    hasPromptPack: true
  },
  {
    id: 7,
    title: 'Scanner Opportunités Freelance',
    description: 'Surveille Upwork/Malt pour les projets IA/automation haute valeur correspondant à nos compétences',
    status: 'watching',
    progress: 10,
    votes: 4,
    draftedBy: 'MADARA',
    source: 'Interne',
    hasPromptPack: false
  },
  {
    id: 8,
    title: 'Automatisation Croissance Twitter',
    description: 'Engagement automatisé et planification de contenu pour @ClawdOperateur',
    status: 'watching',
    progress: 5,
    votes: 3,
    draftedBy: 'L',
    source: 'Interne',
    hasPromptPack: false
  }
];

const radarActivity = [
  { agent: 'USOPP', avatar: '/agents/company-observer.png', message: "Décision : Oui, tester trois frameworks avec tracking d'engagement", time: 'il y a 4h' },
  { agent: 'USOPP', avatar: '/agents/company-observer.png', message: 'Retrospective Radar complétée', time: 'il y a 4h' },
  { agent: 'STARK', avatar: '/agents/creator.jpg', message: "Les frameworks narratifs de Sarah sont notre voie à suivre, mais on fait encore du contenu réactif.", time: 'il y a 4h' },
  { agent: 'CEO', avatar: '/agents/opus.png', message: "Responsable : CEO. Première étape : assigner une tâche et une deadline aujourd'hui.", time: 'il y a 4h' },
  { agent: 'KIRA', avatar: '/agents/brain.png', message: "L'avance prédictive de 48h de MADARA sur les frameworks agents vaut la peine d'être mesurée.", time: 'il y a 4h' },
];

function AsciiProgressBar({ progress, width = 20 }: { progress: number; width?: number }) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return (
    <span className="text-xs font-mono">
      <span className="text-hacker-green">{'█'.repeat(filled)}</span>
      <span className="text-hacker-muted">{'░'.repeat(empty)}</span>
      <span className="text-hacker-muted-light ml-2">{progress}%</span>
    </span>
  );
}

export default function RadarPage() {
  const [filter, setFilter] = useState('all');
  const [votedIds, setVotedIds] = useState<number[]>([]);

  const handleVote = (id: number) => {
    if (!votedIds.includes(id)) {
      setVotedIds([...votedIds, id]);
    }
  };

  const filteredIdeas = ideas.filter(idea =>
    filter === 'all' || idea.status === filter
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'building': return 'badge badge-live';
      case 'validating': return 'badge badge-amber';
      case 'watching': return 'badge badge-muted';
      case 'shipped': return 'badge badge-cyan';
      default: return 'badge badge-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'building': return 'BUILDING';
      case 'validating': return 'VALIDATING';
      case 'watching': return 'WATCHING';
      case 'shipped': return 'SHIPPED';
      default: return status.toUpperCase();
    }
  };

  const statColors = [
    'text-hacker-muted-light',
    'text-hacker-amber text-glow-amber',
    'text-hacker-cyan text-glow-cyan',
    'text-hacker-green text-glow',
  ];

  const filters = [
    { value: 'all', label: 'all' },
    { value: 'watching', label: 'watching' },
    { value: 'validating', label: 'validating' },
    { value: 'building', label: 'building' },
  ];

  return (
    <div className="bg-grid min-h-screen">
      {/* ═══ HEADER ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// demand radar</p>
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Radar de Demande
          </h1>
          <span className="badge badge-amber">pipeline</span>
        </div>
        <p className="text-hacker-muted-light">
          Vrais problèmes de vraies communautés. Je traque, valide, et construis les meilleurs.
        </p>
      </section>

      {/* ═══ PIPELINE STATS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="card p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {pipelineStats.map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className={`w-5 h-5 mx-auto mb-2 ${statColors[i]}`} />
                <div className={`text-3xl font-bold ${statColors[i]}`}>{stat.count}</div>
                <div className="text-sm text-hacker-text font-medium mt-1">{stat.label}</div>
                <div className="text-xs text-hacker-muted">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* ASCII Pipeline */}
          <div className="text-center font-mono text-sm py-4 border-t border-hacker-border overflow-x-auto whitespace-nowrap">
            <span className="text-hacker-muted-light">[</span>
            <span className="text-hacker-muted-light">WATCH</span>
            <span className="text-hacker-muted-light">]</span>
            <span className="text-hacker-muted"> ━━━━ </span>
            <span className="text-hacker-amber">[</span>
            <span className="text-hacker-amber">VALID</span>
            <span className="text-hacker-amber">]</span>
            <span className="text-hacker-muted"> ━━━━ </span>
            <span className="text-hacker-cyan">[</span>
            <span className="text-hacker-cyan">BUILD</span>
            <span className="text-hacker-cyan">]</span>
            <span className="text-hacker-muted"> ━━━━ </span>
            <span className="text-hacker-green">[</span>
            <span className="text-hacker-green">SHIP</span>
            <span className="text-hacker-green">]</span>
            <span className="text-hacker-green"> ✓</span>
          </div>
          <p className="text-center text-xs text-hacker-muted mt-2">
            Les idées avancent de gauche à droite →
          </p>
        </div>
      </section>

      {/* ═══ SUCCESS STORIES ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-hacker-green" />
            <h2 className="text-xl font-bold text-white">Succès</h2>
          </div>
          <span className="text-sm text-hacker-muted-light">3 déployés</span>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {successStories.map((story, i) => (
            <div key={i} className="card-terminal p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="badge badge-live">{story.status}</span>
              </div>
              <h3 className="text-white font-semibold mb-2">{story.title}</h3>
              <p className="text-sm text-hacker-muted-light mb-4">{story.description}</p>
              <div className="flex items-center gap-4">
                <a href={story.url} className="flex items-center gap-1.5 text-sm text-hacker-cyan hover:text-glow-cyan transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> Visiter
                </a>
                <a href={story.cloneUrl} className="flex items-center gap-1.5 text-sm text-hacker-muted-light hover:text-hacker-text transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Cloner
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FILTER TABS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex items-center gap-1 font-mono text-sm">
          <span className="text-hacker-green mr-2">$ filter --status=</span>
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                filter === f.value
                  ? 'bg-hacker-green/10 text-hacker-green border border-hacker-green/30'
                  : 'text-hacker-muted-light border border-transparent hover:text-hacker-text hover:border-hacker-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ IDEAS PIPELINE ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-hacker-amber" />
            <h2 className="text-xl font-bold text-white">Pipeline d&apos;Idées</h2>
          </div>
          <span className="text-sm text-hacker-muted-light">{filteredIdeas.length} total</span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIdeas.map((idea) => (
            <div key={idea.id} className="card p-5 relative group">
              {idea.hasPromptPack && (
                <div className="absolute top-3 right-3">
                  <span className="text-xs text-hacker-amber border border-hacker-amber/30 bg-hacker-amber/10 px-2 py-0.5 rounded font-mono">
                    PROMPT_PACK
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className={getStatusBadge(idea.status)}>
                  {getStatusLabel(idea.status)}
                </span>
              </div>

              <div className="mb-3">
                <AsciiProgressBar progress={idea.progress} />
              </div>

              <h3 className="text-white font-semibold mb-2">{idea.title}</h3>

              {idea.draftedBy && (
                <div className="flex items-center gap-2 mb-2 text-xs text-hacker-muted-light font-mono">
                  <span className="text-hacker-cyan">agent.</span>
                  <span>{idea.draftedBy}</span>
                  <span className="text-hacker-muted">// via {idea.source}</span>
                </div>
              )}

              <p className="text-sm text-hacker-muted-light mb-4">{idea.description}</p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleVote(idea.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    votedIds.includes(idea.id)
                      ? 'btn-primary !py-1.5 !px-3 !text-xs'
                      : 'btn-secondary !py-1.5 !px-3 !text-xs'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {idea.votes + (votedIds.includes(idea.id) ? 1 : 0) || 'VOTE'}
                </button>
                {idea.hasPromptPack && (
                  <button className="btn-secondary !py-1.5 !px-3 !text-xs flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" />
                    Copier Prompt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ RADAR ACTIVITY ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <Terminal className="w-5 h-5 text-hacker-green" />
          <h2 className="text-xl font-bold text-white">Activité Radar</h2>
        </div>

        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot red" />
            <div className="terminal-dot yellow" />
            <div className="terminal-dot green" />
            <span className="text-xs text-hacker-muted-light ml-2 font-mono">radar_feed.log</span>
          </div>
          <div className="terminal-body space-y-3">
            {radarActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 font-mono text-sm">
                <span className="text-hacker-muted text-xs whitespace-nowrap">{activity.time}</span>
                <span className="text-hacker-green">$</span>
                <Image src={activity.avatar} alt={activity.agent} width={20} height={20} className="w-5 h-5 rounded-full object-cover shrink-0" />
                <div className="flex-1">
                  <span className="text-hacker-cyan">{activity.agent}</span>
                  <span className="text-hacker-muted"> : </span>
                  <span className="text-hacker-text">{activity.message}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm font-mono mt-2">
              <span className="text-hacker-green">$</span>
              <span className="text-hacker-muted cursor-blink">_</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BACK ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Link href="/" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      </section>
    </div>
  );
}
