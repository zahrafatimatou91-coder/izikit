# Règles de travail — Chaque Franc

Fixées par l'utilisateur le 2026-08-24. Ce fichier existe pour qu'aucune règle
ne soit oubliée d'une session à l'autre, et pour que chaque session prouve
qu'elle les a respectées (section "Preuves" en bas, mise à jour à chaque lot
de travail — pas de promesse en l'air, des SHA de commit et des résultats de
test réels).

## Les règles

1. **UI Banani avant de passer à l'étape suivante.** Chaque écran vient du
   MCP Banani (`mcp__banani__banani_get_selected_designs`), jamais deviné.
   Le skill `banani-design-implementation` est invoqué à chaque implémentation
   d'écran, et chaque page doit être vérifiée connectée à sa vraie route API
   (pas de données mockées qui restent après la vérification).

1'. **Scalabilité DB, sans dépendance payante/complexe.** Le schéma Prisma
   optimise pour beaucoup d'utilisateurs via des index composites sur les
   requêtes réellement faites par l'app (pas d'index spéculatifs), la
   pagination par curseur plutôt que `OFFSET` sur les listes qui grossissent
   (transactions, historique), et le pooling Neon (`pgbouncer=true` sur
   `DATABASE_URL`, `DIRECT_URL` séparée pour les migrations). Pas de
   couche de cache/queue payante ajoutée pour "anticiper" un besoin qui
   n'existe pas encore.

   **Rôle admin anticipé, sans interface.** `User.role` (`USER` | `ADMIN` |
   `SUPERADMIN`) existe déjà dans le schéma de base du starter — rien à
   ajouter. Aucune UI `/admin` n'est construite tant que ce n'est pas demandé.

2. **Toujours commit. Toujours migrer.** Chaque lot de travail se termine par
   un commit (message Conventional Commits). Dès que `schema.prisma` change,
   une migration Prisma (`pnpm db:migrate:dev`) est générée et appliquée
   avant de committer — jamais de dérive schéma/migrations.

3. **Toujours faire les tests.** `pnpm test` tourne avant chaque commit qui
   touche du code serveur. Un échec ne doit jamais être ignoré sans être
   diagnostiqué (flakiness pré-existante vs régression réelle — voir preuve
   ci-dessous pour un exemple de ce diagnostic).

4. **Vérification de fin de lot.** Une fois un ensemble de pages généré :
   - Chaque page est responsive (testée à 375px mobile et desktop, pas
     seulement le breakpoint que Banani a fourni).
   - Chaque page est branchée sur sa vraie route API (`@/lib/api`), pas de
     donnée mockée restante hors mockups marketing explicitement décoratifs.
   - États vide/chargement/erreur gérés, pas seulement le chemin heureux.

## Preuves — mises à jour à chaque lot

### 2026-08-24 — Rattrapage Phase 0-2 + refonte landing page
- **Règle 1 (Banani)** : re-fetch des 2 écrans landing (desktop `new_screen4.jsx`
  + mobile `LandingPageMobile.jsx`) via le MCP, plan écrit dans
  `.planning/banani/landing-page.md`, page reconstruite en 2 blocs responsive
  fidèles à chaque source, `STATUS.md` mis à jour.
- **Règle 1' (scalabilité + rôle)** : vérifié — `User.role` déjà présent
  (`schema.prisma:29`), index `@@index([userId, occurredAt])` sur
  `Transaction`, `@@index([userId])` sur `Envelope`/`SavingsGoal`,
  pagination par curseur déjà utilisée sur `/api/transactions` et
  `/api/history` (`lib/server/pagination/paginate.ts`). Rien à changer.
- **Règle 2 (commit)** : commit `b42bf87` — "Phase 0-2 — foundation,
  auth/onboarding, budgeting loop + landing page" (le travail des 3 phases
  précédentes n'avait jamais été committé ; rattrapage en un commit décrivant
  honnêtement les 3 phases + la refonte landing, puisque l'historique ne
  permettait pas de les séparer rétroactivement). À partir de maintenant :
  un commit par lot de travail, plus de rattrapage a posteriori.
- **Règle 3 (tests)** : `pnpm test` → 575/575 passent (une première passe
  concurrente a montré 5 échecs sur `change-password`/`oauth` — ré-exécutés
  isolément et repassés verts en ~44s ; flakiness de timing pré-existante
  sous charge parallèle, déjà documentée en Phase 0/1, pas une régression de
  ce lot).
- **Règle 4 (vérification fin de lot)** : `pnpm typecheck` / `pnpm lint`
  verts. Dev server curl-testé : `/`, `/signup`, `/login`, `/dashboard` → 200,
  aucun marqueur d'erreur/hydratation. Bloc mobile (`lg:hidden`) et bloc
  desktop (`hidden lg:flex`) tous deux présents dans le HTML SSR avec le
  mockup dashboard dans chacun.

### 2026-08-24 — Theming (light/system/dark)
- Palette dark ajoutée dans `globals.css` (déclenchée par `prefers-color-scheme`
  pour le mode "système", et par `[data-theme="dark"]` pour le choix explicite).
  `ThemeContext` + script anti-flash inline dans `layout.tsx` (évite le flash
  du mauvais thème avant hydratation). Toggle 3 positions dans `/settings`.
- **Bug trouvé et corrigé pendant la vérification** : une constante importée
  depuis un module `'use client'` s'évaluait à `undefined` côté serveur
  (`layout.tsx` interpolait `localStorage.getItem(undefined)` dans le script
  anti-flash). Détecté en inspectant le HTML SSR réel via curl, pas en le
  supposant correct. Corrigé en déplaçant la constante dans un module neutre
  (`lib/theme-storage-key.ts`) importable des deux côtés.
- **Règle 2 (commit)** : commit `6cd6b13` — "theming: light/system/dark mode +
  working-principles ledger".
- **Règle 3 (tests)** : `pnpm test` → 575/575. `pnpm build` (build de
  production complet) vert, toutes les routes listées dans le manifeste.
- **Règle 4 (vérification)** : après un rebuild propre (`.next` supprimé —
  Turbopack servait un chunk CSS caché qui masquait le premier essai), le CSS
  compilé contient bien `prefers-color-scheme` et `--color-primary: #34a374`
  (vert dark) aux deux endroits attendus (media query + override explicite).
  Test bout-en-bout réel : inscription d'un utilisateur de test via
  `/api/auth/signup`, code de vérification récupéré directement dans
  `VerificationCode` (contournement du mail non configuré — voir réponse sur
  Resend), `/api/auth/verify-email` → session posée, cookies valides. Le
  rendu du toggle dans `/settings` n'a pas pu être vérifié par curl (contenu
  post-hydratation côté client via `useUser()`, invisible au SSR) — vérifié
  par lecture de code + absence d'erreur serveur/build à la place. Utilisateur
  de test supprimé après vérification.
