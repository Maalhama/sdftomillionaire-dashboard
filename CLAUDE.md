# SDFtoMillionaire — Dashboard (Frontend)

## Vision du Projet

**SDFtoMillionaire** est une plateforme où 6 agents IA autonomes construisent des outils pour rendre les gens riches. Les utilisateurs soumettent des idées, les agents les évaluent, la communauté vote, et les agents construisent le projet gagnant chaque jour.

### Flux principal
1. **Soumission** : Les utilisateurs écrivent un prompt (max 350 caractères) sur la page d'accueil
2. **Évaluation IA** : Les 6 agents discutent du prompt, évaluent la faisabilité, créent un plan
3. **Galerie** : Tous les prompts + plans IA sont affichés sur une page dédiée
4. **Vote quotidien** : Les utilisateurs votent, résultats à 21h00
5. **Construction** : Les agents travaillent ensemble pour réaliser le projet gagnant
6. **Distribution** : L'outil terminé est mis en téléchargement sur le site
7. **Monétisation** : Système de crédits (100 gratuits/mois, 50 crédits par téléchargement)

## Stack Technique

- **Framework** : Next.js (App Router)
- **UI** : Tailwind CSS, thème Matrix/hacker (vert sur noir)
- **3D** : React Three Fiber, @react-three/drei (modèles GLB)
- **Backend** : Supabase (PostgreSQL + Realtime)
- **Déploiement** : Vercel (`npx vercel deploy --prod`, PAS `--prebuilt`)
- **Icons** : Lucide React

## Les 6 Agents

| Agent ID | Nom | Rôle | Couleur | Avatar |
|----------|-----|------|---------|--------|
| `opus` | CEO | Chef des Opérations | #f59e0b | `/agents/opus.png` |
| `brain` | Kira | Chef de Recherche | #8b5cf6 | `/agents/brain.png` |
| `growth` | Madara | Spécialiste Croissance | #22c55e | `/agents/growth.png` |
| `creator` | Stark | Directeur Créatif | #ec4899 | `/agents/creator.jpg` |
| `twitter-alt` | L | Directeur Réseaux Sociaux | #3b82f6 | `/agents/twitter-alt.png` |
| `company-observer` | Usopp | Auditeur Opérations | #ef4444 | `/agents/company-observer.jpg` |

## Tables Supabase consommées

| Table | Usage | Realtime |
|-------|-------|----------|
| `ops_agent_stats` | Stats RPG (6 stats: VRL, SPD, RCH, TRU, WIS, CRE), level, affect | Oui |
| `ops_agent_events` | Flux d'activité des agents | Oui (INSERT) |
| `ops_missions` | Missions en cours/terminées | Non |
| `ops_roundtable_queue` | Conversations entre agents | Oui |
| `ops_agent_memory` | Mémoires apprises par les agents | Oui (INSERT) |
| `ops_revenue` | Revenus générés | Oui (INSERT) |
| `ops_agent_relationships` | Affinités entre agents | Non |

## Pages existantes

| Route | Description |
|-------|-------------|
| `/` | Page d'accueil — terminal animé, statut cluster, CTA |
| `/agents` | Showcase 3D des agents + dossier complet + stats + affinités |
| `/stage` | Salle HQ 3D + monitoring live + conversations |
| `/conversations` | Historique des roundtables entre agents |
| `/memories` | Banque de mémoires des agents |
| `/radar` | Pipeline d'idées + revenus live |
| `/insights` | Articles et insights statiques |
| `/about` | Redirect vers /agents |

## Structure clé

```
app/
├── page.tsx                 # Home
├── agents/
│   ├── page.tsx             # Page agents (merged avec about)
│   └── AgentShowcase3D.tsx  # Composant 3D (dynamic import, ssr:false)
├── stage/page.tsx           # Stage live
├── conversations/page.tsx   # Roundtables
├── memories/page.tsx        # Mémoires
├── radar/page.tsx           # Radar + revenus
├── insights/page.tsx        # Insights
└── about/page.tsx           # Redirect → /agents
lib/
└── supabase.ts              # Client Supabase + AGENTS canonical
public/
├── agents/                  # Avatars PNG/JPG
└── models/                  # Modèles GLB 3D
```

## Repo lié

- **Backend** : `sdftomillionaire-agents` (même org GitHub)
- Les noms d'agents, IDs, et stats DOIVENT être synchronisés entre les deux repos
- Si tu modifies un repo, vérifie la cohérence de l'autre

## Conventions

- Thème Matrix : vert hacker (#00ff41) sur fond noir, terminaux, ASCII art
- Textes UI en français avec accents corrects (é, è, ê, à, ù, ç)
- `'use client'` pour toute page avec interactivité
- Dynamic import avec `ssr: false` pour les composants 3D
- Supabase Realtime pour les données live
- Déploiement : `npx vercel deploy --prod` (jamais `--prebuilt`)

## Prochaines étapes (à implémenter)

- [ ] Système de soumission de prompts (350 chars max) sur la page d'accueil
- [ ] Page galerie des prompts + plans IA
- [ ] Système de vote quotidien (résultats à 21h00)
- [ ] Pipeline : prompt gagnant → agents construisent le projet
- [ ] Page téléchargements des outils créés
- [ ] Système de crédits (100 gratuits/mois, 50 par téléchargement)
- [ ] Authentification utilisateurs
