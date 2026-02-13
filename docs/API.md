# API Documentation

Toutes les routes sont sous `/api/`. Les routes nécessitant une authentification attendent un header `Authorization: Bearer <access_token>`.

## Prompts

### `GET /api/prompts`

Récupère les prompts avec pagination.

**Query params** :
- `page` (number) — page courante (défaut : 1)
- `status` (string) — filtrer par statut (`pending`, `evaluating`, `evaluated`, `winner`, `building`, `closed`)

**Réponse** : `200`
```json
{
  "prompts": [...],
  "total": 42,
  "page": 1
}
```

### `POST /api/prompts`

Soumettre un nouveau prompt.

**Body** :
```json
{
  "content": "Mon idée (350 chars max)",
  "author_name": "Pseudo"
}
```

**Réponse** : `201`
```json
{ "id": "uuid", "content": "...", "status": "pending" }
```

---

## Votes

### `POST /api/prompts/[id]/vote`

Voter pour un prompt. Optionnellement authentifié.

**Headers** (optionnel) : `Authorization: Bearer <token>`

**Réponse** : `200`
```json
{ "votes_count": 15 }
```

**Erreurs** :
- `400` — Prompt non ouvert au vote
- `409` — Déjà voté (par IP ou par user_id)

---

## Crédits

### `GET /api/credits`

Récupère le solde et l'historique des transactions.

**Headers** : `Authorization: Bearer <token>` (requis)

**Réponse** : `200`
```json
{
  "balance": 75,
  "lifetime_earned": 200,
  "lifetime_spent": 125,
  "transactions": [
    {
      "amount": -50,
      "type": "download_spend",
      "description": "Téléchargement: Super Tool",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Erreurs** :
- `401` — Non authentifié / token invalide

---

## Téléchargement

### `POST /api/tools/[id]/download`

Télécharger un outil (coûte 50 crédits).

**Headers** : `Authorization: Bearer <token>` (requis)

**Réponse** : `200`
```json
{
  "success": true,
  "downloads_count": 43,
  "credits_remaining": 50
}
```

**Erreurs** :
- `401` — Non authentifié (`code: "AUTH_REQUIRED"`)
- `402` — Crédits insuffisants (`code: "INSUFFICIENT_CREDITS"`, `balance`, `cost`)
- `404` — Outil introuvable
- `400` — Outil non publié

---

## Auth Callback

### `GET /auth/callback`

Route de callback OAuth. Échange le code contre une session Supabase et redirige vers `/gallery`.
