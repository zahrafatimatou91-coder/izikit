# Vérification finale — toutes les pages (Phases 0 à 5)

Date : 2026-08-24. Exécutée à la demande explicite de l'utilisateur, en
application de la Règle 4 de `.planning/PRINCIPLES.md` : *"à la fin de la
génération de toutes les pages, vérifier que tout est bien intégré de
manière responsive, bien connecté au backend, et bien géré."*

Ce document est la preuve de cette vérification — pas un résumé de ce qui
a été construit (voir `STATUS.md` pour ça), mais le compte-rendu de ce qui
a été **testé, et comment**.

## Méthodologie (et ses limites, en toute transparence)

Trois couches de vérification, combinées :

1. **Analyse statique** (grep sur les 20 fichiers `page.tsx`) : présence de
   classes responsive (`lg:`), présence d'appels `api()` réels, présence de
   gestion d'état (erreur/chargement/vide), absence de classes Tailwind
   brutes non-thémées (`bg-gray-*`, `bg-black`...) qui casseraient le mode
   sombre.
2. **Test dynamique côté serveur** (curl avec une vraie session
   authentifiée, contre le serveur de dev réel) : chaque route retourne
   bien 200, sans marqueur d'erreur serveur (`Application error`,
   `hydration mismatch`, `Internal Server Error`...).
3. **Test de l'API réelle** (déjà fait de façon extensive au fil des
   Phases 3/4/5 dans ce même document de session, et pour les Phases 0-2
   dans les entrées précédentes de `STATUS.md`) : chaque mutation testée
   avec de vraies données, y compris les cas limites (idempotence,
   cascade, dédoublonnage, guards cross-tenant).

**Limite honnête** : `curl` n'exécute pas de JavaScript. Toutes les pages
authentifiées de cette app sont des Client Components qui font
`if (!user) return null` tant que `useUser()` n'a pas résolu son fetch
côté client — leur HTML server-rendu est donc un shell vide par design (ce
n'est pas un bug, c'est le modèle d'auth choisi dès la Phase 1). `curl` peut
donc confirmer *"le serveur ne plante pas, l'API répond juste, le bundle
compile"*, mais pas *"le rendu visuel est correct au pixel près"`. J'ai
tenté d'installer Playwright pour un test navigateur réel et prendre des
captures : `npx playwright install chromium` échoue avec
`ERROR: Playwright does not support chromium on mac13` — contrainte de cet
environnement (macOS 13), pas quelque chose que je peux contourner sans
modification système plus risquée. La vérification visuelle finale se fera
donc quand vous testerez vous-même dans un vrai navigateur (ce qui est
justement l'étape suivante une fois Resend/Google connectés).

## Tableau page par page

| Route | Responsive | API réelle | États gérés | Note |
|---|---|---|---|---|
| `/` (landing) | ✅ 44 usages `lg:`, 2 blocs jumeaux mobile/desktop | N/A (marketing pré-auth, volontairement statique) | N/A | — |
| `/login` | ✅ via `AuthShell` (`lg:flex` panneau gauche caché en mobile) | ✅ `POST /api/auth/login` | ✅ erreur/chargement | — |
| `/signup` | ✅ via `AuthShell` | ✅ `POST /api/auth/signup` | ✅ | — |
| `/forgot-password` | ✅ via `AuthCard` (`w-full max-w-md px-4`, fluide) | ✅ | ✅ | — |
| `/reset-password` | ✅ via `AuthCard` | ✅ | ✅ | — |
| `/verify-email` | ✅ via `AuthCard` | ✅ | ✅ | — |
| `/auth/error` | ✅ (`max-w-md`, fluide) | N/A (lit juste `?code=` de l'URL) | N/A | **Corrigé pendant cet audit** : utilisait encore `bg-black`/`text-gray-*` bruts (héritage Phase 1, jamais mis à jour lors du theming) — ne respectait pas le mode sombre. Basculé sur les tokens du design system. |
| `/onboarding` | ✅ | ✅ `POST /api/onboarding` | ✅ | Pré-remplit maintenant le budget existant (petit correctif fait en Phase 5 pour que le lien "Modifier" de Settings ne réinitialise pas silencieusement le formulaire) |
| `/dashboard` | ✅ 20 usages `lg:` | ✅ `GET /api/dashboard` | ✅ vide/chargement/erreur | — |
| `/envelopes` | ✅ 12 usages `lg:` | ✅ CRUD complet (`GET/POST/PATCH/DELETE`) | ✅ | — |
| `/history` | ✅ 9 usages `lg:` | ✅ `GET /api/transactions` (curseur) | ✅ | — |
| `/transactions/new` | ✅ | ✅ `POST /api/transactions` | ✅ | — |
| `/progress` | ✅ 8 usages `lg:` | ✅ `GET /api/savings-goals` | ✅ | — |
| `/savings/new` | ✅ | ✅ `POST /api/savings-goals` | ✅ | — |
| `/savings/[id]/add` | ✅ 7 usages `lg:` | ✅ `POST /api/savings-goals/[id]/entries` | ✅ | — |
| `/savings/[id]/confirmed` | ✅ 8 usages `lg:` | ✅ `GET /api/savings-goals/[id]` | ✅ | — |
| `/tips` | ✅ 9 usages `lg:` | ✅ `GET /api/tips` | ✅ | — |
| `/tips/[id]` | ✅ 10 usages `lg:` | ✅ `GET /api/tips/[id]` | ✅ | — |
| `/tips/[id]/apply` | ✅ 8 usages `lg:` | ✅ `POST /api/tips/[id]/apply` | ✅ | — |
| `/notifications` | ✅ 7 usages `lg:` | ✅ `GET/PATCH /api/notifications` | ✅ vide/chargement/erreur | — |
| `/settings` | ✅ 13 usages `lg:` | ✅ 6 endpoints (`/auth/me`, `/auth/change-password`, `/auth/set-password`, `/notifications/prefs`, `/account`, OAuth link) | ✅ | Reconstruite en Phase 5 (n'avait aucune structure de navigation avant) |

**20/20 pages retournent HTTP 200, zéro marqueur d'erreur**, testé avec une
session authentifiée réelle et des données de test réelles (budget défini,
enveloppe créée, objectif d'épargne créé, conseil récupéré — pour que les
routes paramétrées ne tombent pas sur un cas 404 qui masquerait un vrai
bug).

## Bug trouvé et corrigé pendant cet audit

**`/auth/error`** utilisait encore la palette Tailwind brute
(`bg-black`, `text-gray-700`, `text-gray-400`, `text-gray-600`) héritée du
portage initial (`examples/frontend-pages/auth-error.tsx`, Phase 1) — avant
que le theming clair/sombre existe. Résultat concret : cette page ignorait
le thème choisi par l'utilisateur (toujours blanc/noir même en mode
sombre). C'est la seule page sur les 20 à avoir ce problème (vérifié par
balayage sur toutes les autres). Corrigée pour utiliser les tokens du
design system (`bg-background`, `text-foreground`, `bg-primary`, etc.),
comme le reste de l'application.

## Ce qui a déjà été vérifié en profondeur (pas re-testé ici, déjà prouvé)

Chaque mutation API a été testée en conditions réelles au fil des phases
(voir `STATUS.md` pour le détail par phase) :
- Idempotence (`POST /api/tips/[id]/apply`, ré-application ne duplique pas)
- Incréments atomiques (`SavingsGoal.currentAmount` vs somme des entrées)
- Dédoublonnage des notifications (alerte enveloppe à 80%/100%, objectif
  atteint, conseil appliqué — chacun testé pour ne se déclencher qu'une
  fois)
- Garde-fous cross-tenant (404 sur un ID d'un autre utilisateur)
- Cascade de suppression de compte (0 ligne orpheline après
  `DELETE /api/account`, vérifié par requête DB directe)
- Guard d'activation des préférences de notification (le toggle dans
  Settings gate réellement le déclencheur, pas juste visuellement)

## Prochaine étape (hors périmètre de cet audit)

La vérification visuelle/interactive finale (est-ce que ça a l'air bien,
est-ce que les breakpoints tombent au bon endroit à l'œil) nécessite un
vrai navigateur — impossible à automatiser dans cet environnement (voir
limite Playwright ci-dessus). Recommandé : un passage manuel rapide dans
Chrome/Safari à 375px et desktop une fois Resend + Google OAuth branchés
(section suivante), puisque c'est le moment où vous pourrez réellement vous
connecter et naviguer dans l'app.
