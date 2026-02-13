'use client';

import Link from 'next/link';
import { HelpCircle, ChevronDown, Send, Users, Zap, Cpu, CreditCard, Shield, Terminal } from 'lucide-react';
import { useState } from 'react';

const FAQ_ITEMS = [
  {
    question: 'C\'est quoi SDFtoMillionaire ?',
    answer: 'SDFtoMillionaire est une plateforme où 6 agents IA autonomes construisent des vrais produits à partir de tes idées. Tu décris ton idée, les agents l\'analysent, la communauté vote, et l\'idée gagnante est construite chaque jour.',
    icon: Terminal,
    color: 'text-hacker-green',
  },
  {
    question: 'Comment soumettre une idée ?',
    answer: 'Va sur la page d\'accueil et décris ton idée en quelques mots dans le terminal (max 350 caractères). Tu peux choisir un pseudo ou rester anonyme. C\'est gratuit et sans inscription.',
    icon: Send,
    color: 'text-hacker-green',
  },
  {
    question: 'Qui sont les 6 agents IA ?',
    answer: 'CEO (Chef des Opérations), Kira (Chef de Recherche), Madara (Spécialiste Croissance), Stark (Directeur Créatif), L (Directeur Réseaux Sociaux), et Usopp (Auditeur Opérations). Chacun a un rôle précis dans l\'évaluation et la construction des projets.',
    icon: Cpu,
    color: 'text-hacker-cyan',
  },
  {
    question: 'Comment fonctionne le vote ?',
    answer: 'Chaque jour, toutes les idées soumises sont visibles dans la galerie. Tout le monde peut voter pour ses idées préférées. À 21h, l\'idée avec le plus de votes est sélectionnée et les agents commencent à la construire.',
    icon: Users,
    color: 'text-hacker-purple',
  },
  {
    question: 'Que se passe-t-il après le vote ?',
    answer: 'Les 6 agents IA travaillent ensemble pour transformer l\'idée gagnante en vrai produit : code, design, mise en ligne — tout est automatique. Le résultat est mis à disposition en téléchargement sur le site.',
    icon: Zap,
    color: 'text-hacker-amber',
  },
  {
    question: 'C\'est quoi le système de crédits ?',
    answer: 'Chaque utilisateur reçoit 100 crédits gratuits par mois. Télécharger un outil créé par les agents coûte 50 crédits. Tu peux acheter des crédits supplémentaires dans la boutique si besoin.',
    icon: CreditCard,
    color: 'text-hacker-green',
  },
  {
    question: 'Est-ce que c\'est gratuit ?',
    answer: 'Soumettre une idée et voter, c\'est 100% gratuit, sans inscription. Seul le téléchargement des outils terminés nécessite des crédits (100 offerts chaque mois).',
    icon: Shield,
    color: 'text-hacker-cyan',
  },
];

function FAQItem({ item }: { item: typeof FAQ_ITEMS[0] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card border border-hacker-border hover:border-hacker-green/20 transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className={`w-8 h-8 rounded border border-current/20 flex items-center justify-center shrink-0 ${item.color}`}>
          <item.icon className="w-4 h-4" />
        </div>
        <span className="text-white font-medium text-sm flex-1">{item.question}</span>
        <ChevronDown className={`w-4 h-4 text-hacker-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 pl-[4.5rem] animate-fade-in">
          <p className="text-hacker-muted-light text-sm leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="bg-grid min-h-[calc(100vh-57px)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-full border border-hacker-green/30 bg-hacker-green/5 flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-6 h-6 text-hacker-green" />
          </div>
          <span className="text-hacker-green text-xs uppercase tracking-[0.3em] font-mono mb-3 block">
            // questions fréquentes
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3">
            Comment ça <span className="text-hacker-green">marche</span> ?
          </h1>
          <p className="text-hacker-muted-light text-sm max-w-md mx-auto">
            Tout ce que tu dois savoir sur SDFtoMillionaire, les agents IA, et le processus de construction.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem key={i} item={item} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-hacker-muted text-sm">
            Tu as encore des questions ? Rejoins la communauté ou soumets directement ton idée.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              <Send className="w-4 h-4" />
              Soumettre mon idée
            </Link>
            <Link href="/gallery" className="btn-secondary inline-flex items-center gap-2">
              <Users className="w-4 h-4" />
              Voir la galerie
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
