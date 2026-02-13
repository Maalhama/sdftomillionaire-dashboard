# Contribuer à SDFtoMillionaire

## Prérequis

- Node.js 18+
- Compte Supabase (pour le backend)

## Setup local

```bash
git clone https://github.com/Maalhama/sdftomillionaire-dashboard.git
cd sdftomillionaire-dashboard
npm install
cp .env.example .env.local
npm run dev
```

## Workflow

1. Créer une branche depuis `main`
2. Implémenter les changements
3. Vérifier : `npm run lint && npm run type-check && npm test && npm run build`
4. Ouvrir une PR avec le template fourni

## Conventions

- **Langue** : textes UI en français avec accents corrects (é, è, ê, à, ù, ç)
- **Style** : thème Matrix — vert hacker (#00ff41) sur fond noir
- **Composants** : `'use client'` pour toute page interactive
- **3D** : `dynamic import` avec `ssr: false`
- **Commits** : format [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` nouvelle fonctionnalité
  - `fix:` correction de bug
  - `docs:` documentation
  - `refactor:` refactoring sans changement fonctionnel

## Structure des tests

Les tests sont dans `__tests__/` et utilisent Vitest. Nommer les fichiers `<feature>.test.ts`.

```bash
npm test          # Run une fois
npm run test:watch  # Mode watch
```
