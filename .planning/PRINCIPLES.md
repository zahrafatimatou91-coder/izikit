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

### 2026-08-24 — Phase 3 (Épargne/Objectifs)
- **Règle 1 (Banani)** : les écrans sélectionnés dans Banani au moment du fetch
  étaient encore ceux de la landing page (session précédente) — fetch explicite
  par `screenIds` sur les 5 noms de fichiers cités dans `00-roadmap.md`. Les 2
  questions ouvertes du roadmap (écran `CancelAddEconomy` = bug de nommage ?
  quel écran de confirmation choisir ?) ont été tranchées en diffant les
  sources byte-à-byte via script (pas en devinant) — `CancelAddEconomy` est
  bien un artefact (source identique à `MyProgress`), les 2 écrans de
  confirmation sont réels et différents. Plan écrit dans
  `.planning/banani/savings-goals.md` avant tout code.
- **Règle 1' (scalabilité + rôle)** : aucun changement nécessaire — index déjà
  en place, `role` déjà présent. `SavingsGoal.currentAmount` reste dénormalisé
  (pas de `SUM()` à chaque lecture) et n'est incrémenté que dans une seule
  transaction Prisma avec l'insertion de l'entrée — pas de dépendance externe.
- **Règle 2 (commit + migration)** : migration `20260824132056_savings_entry_note`
  générée et appliquée à Neon avant tout code consommant le champ. Commit à
  suivre juste après cette entrée.
- **Règle 3 (tests)** : `pnpm test` → 578/578 (3 nouveaux tests, probablement
  l'inventaire de routes qui détecte les nouvelles routes automatiquement).
- **Règle 4 (vérification fin de lot)** : `pnpm typecheck` / `pnpm lint` /
  `pnpm build` verts, toutes les nouvelles routes dans le manifeste. Test
  bout-en-bout réel contre le serveur de dev (pas juste des routes isolées) :
  utilisateur de test créé, code de vérification récupéré en DB, objectif
  créé, 2 économies ajoutées via curl — incrément atomique vérifié
  (500 → 800, correspond exactement à la somme des entrées), 404 confirmé sur
  un ID d'objectif inexistant (garde cross-tenant), les 3 nouvelles pages
  renvoient 200 sans marqueur d'erreur. Utilisateur de test supprimé
  (cascade a emporté l'objectif + les entrées).

### 2026-08-24 — Phase 4 (Conseils/Tips)
- **Règle 1 (Banani)** : fetch explicite par `screenIds` des 3 écrans cités
  dans `00-roadmap.md` (`AllTipsDesktop`, `TipDetailDesktop`, `ApplyTipDesktop`
  — pas encore sélectionnés dans l'éditeur). Plan écrit dans
  `.planning/banani/tips.md` avant tout code, incluant le décalage de copy
  déjà signalé dans le roadmap ("Conseils personnalisés" implique une
  personnalisation/IA que la décision verrouillée du 2026-08-23 exclut) —
  copy adoucie, seul mécanisme de tri réel conservé (correspondance de
  catégorie par nom d'enveloppe, côté serveur, pas d'IA). Case à cocher
  inerte du design source (`ApplyTipDesktop`, sans `onChange`) non reproduite
  — un design qui ne câble pas sa propre interaction n'est pas fidèle à
  copier tel quel.
- **Règle 1' (scalabilité + rôle)** : `Tip.title` rendu `@unique` (clé
  d'upsert du seed, idempotent) — pas de nouvel index spéculatif au-delà de
  celui déjà généré par la contrainte unique. `SavingsGoal.tipId` est une
  FK optionnelle `onDelete: SetNull` (ne bloque jamais la suppression d'un
  Tip). Aucun changement au rôle admin (déjà en place).
- **Règle 2 (commit + migration)** : 2 migrations générées et appliquées à
  Neon avant le code consommateur — `20260824135158_tips_and_goal_link`
  (`Tip.estimatedSavingsFcfa`, `SavingsGoal.tipId` + relation) et
  `20260824145656_tip_title_unique` (contrainte unique, écrite à la main via
  `prisma migrate diff --script` + `migrate deploy` — `migrate dev` refuse
  l'interactif pour les contraintes destructives dans cet environnement
  non-TTY). Commit à suivre juste après cette entrée.
- **Règle 3 (tests)** : `pnpm test` → 581/581. Bug d'environnement trouvé et
  corrigé en cours de route (sans lien direct avec Tips mais bloquant le
  seed) : le garde-fou CLI `import.meta.url === file://${process.argv[1]}`
  échoue silencieusement dès que le chemin du projet contient un espace
  ("chaque franc") — corrigé avec `pathToFileURL()` dans `seed-tips.ts` et,
  par cohérence, dans les 3 scripts frères qui avaient le même bug
  (`seed-dev.ts`, `make-superadmin.ts`, `smoke-auth.ts`) — `scripts/seed-dev.test.ts`
  + `scripts/make-superadmin.test.ts` (9 tests) re-passés verts après coup.
- **Règle 4 (vérification fin de lot)** : `pnpm typecheck` / `pnpm lint` /
  `pnpm format` verts. Test bout-en-bout réel contre le serveur de dev :
  utilisateur de test créé, code de vérification récupéré en DB, `GET
  /api/tips` renvoie les 9 conseils seedés, `GET /api/tips/[id]` renvoie le
  bon découpage en 4 étapes pour "Transport malin", `POST
  /api/tips/[id]/apply` → 201 (création d'un `SavingsGoal` avec
  `targetAmount: 2400`, `period: monthly`, `icon: bike`, `tipId` renseigné)
  puis 200 au rejeu (même id d'objectif, pas de doublon — idempotence
  confirmée par requête DB directe), objectif bien visible dans `GET
  /api/savings-goals`, les 3 nouvelles pages renvoient 200 sans marqueur
  d'erreur/hydratation. Incident intermédiaire : le serveur de dev restait
  actif depuis avant la migration et servait un Prisma Client obsolète en
  cache mémoire (même classe de bug que le cache CSS Turbopack déjà rencontré
  en Phase theming) — corrigé en tuant le process, vidant `.next`, et
  relançant ; re-vérifié propre ensuite. Utilisateur de test supprimé après
  vérification (cascade a emporté l'objectif).

### 2026-08-24 — Phase 5 (Notifications + Paramètres)
- **Règle 1 (Banani)** : fetch explicite par `screenIds` des 2 écrans
  (`NotificationsDesktop`, `SettingsDesktop`). Plan écrit dans
  `.planning/banani/notifications-settings.md` avant tout code, avec un
  tableau explicite section-par-section (réel vs abandonné) pour
  `SettingsDesktop` — Banani en propose 5, seules ~7 des ~11 lignes sont
  réellement branchables (téléphone, sessions actives, répartition
  automatique n'existent nulle part dans le schéma). Problème trouvé à
  l'étape 0 (lecture du système avant tout code) : une seule notification
  était jamais déclenchée dans toute l'app (`WELCOME`, uniquement à
  l'inscription Google) — la majorité des utilisateurs (email/mot de passe)
  n'en recevait jamais aucune. Construire l'UI de liste seule aurait laissé
  `/notifications` vide en permanence pour la plupart des comptes —
  décoratif, pas "connecté à sa vraie API" au sens de la Règle 1. 3
  déclencheurs réels ajoutés en conséquence (alerte enveloppe, conseil
  appliqué, objectif atteint), chacun mappé sur un filtre réel de Banani
  pour qu'aucun onglet ne reste mort — décision de périmètre non demandée
  explicitement, signalée à l'utilisateur pour veto possible.
- **Règle 1' (scalabilité + rôle)** : le déclencheur `ENVELOPE_THRESHOLD`
  réutilise `currentBudgetPeriod` (déjà utilisé par `/api/dashboard`,
  aucune nouvelle logique de période) et un seul `aggregate` Prisma
  supplémentaire par transaction-dépense-avec-enveloppe (pas de requête en
  boucle). Aucun changement au rôle admin.
- **Règle 2 (commit + migration)** : **aucun changement de schéma ce
  lot** — `Notification`/`NotificationPreferences` existaient déjà depuis
  le starter ; donc aucune migration nécessaire (règle respectée
  trivialement, mentionné explicitement plutôt que silencieusement omis).
  Commit à suivre juste après cette entrée.
- **Règle 3 (tests)** : `pnpm test` → 582/582.
- **Règle 4 (vérification fin de lot)** : `pnpm typecheck` / `pnpm lint`
  verts. Test bout-en-bout réel contre le serveur de dev avec 2
  utilisateurs de test jetables : `PATCH /api/auth/me` met à jour le nom ;
  l'alerte enveloppe se déclenche distinctement à 80% puis à 100% (pas de
  triplon sur une 3e transaction au-delà de la limite — dédoublonnage
  confirmé) et ne se déclenche PAS du tout quand le nouveau toggle de
  Paramètres la désactive (testé via PATCH direct des préférences) ;
  la notification « conseil appliqué » se déclenche une fois à la création,
  jamais sur le rejeu idempotent ; « objectif atteint » se déclenche une fois
  à la complétion, jamais sur une entrée suivante qui dépasse encore la
  cible ; le filtre `?type=` renvoie le bon sous-ensemble ; « tout marquer
  comme lu » remet le compteur à 0 ; `DELETE /api/account` refuse un mauvais
  mot de passe (400), réussit avec le bon (200) et invalide vraiment la
  session (`/api/auth/me` → 401 ensuite) ; le chemin compte-OAuth-seul
  (passwordHash mis à null pour simuler) refuse une confirmation email
  erronée et réussit avec la bonne ; suppression en cascade confirmée
  propre par requête DB directe (0 lignes sur enveloppes/transactions/
  objectifs/notifications après coup). `/notifications` et `/settings`
  renvoient 200 sans marqueur d'erreur/hydratation. Les 2 utilisateurs de
  test ont été supprimés via le vrai endpoint `DELETE /api/account` (pas
  un nettoyage DB manuel — l'endpoint testé a servi de sa propre
  décommission).

### 2026-08-24 — Vérification finale (Règle 4, demande explicite)
- **Règle 4 (vérification de fin de lot, sur l'ensemble des 20 pages)** :
  rapport complet dans `.planning/banani/VERIFICATION.md` — méthodologie,
  tableau page par page (responsive / API réelle / états gérés), et un vrai
  bug trouvé et corrigé pendant l'audit (`/auth/error` utilisait encore des
  classes Tailwind brutes non-thémées depuis la Phase 1, ignorant le mode
  sombre — corrigé). 20/20 pages retournent 200 sans marqueur d'erreur,
  testées avec une session authentifiée réelle et des données réelles
  (budget, enveloppe, objectif, conseil) pour que les routes paramétrées ne
  masquent pas un 404 silencieux. Tentative d'installer Playwright pour une
  vérification visuelle réelle (captures d'écran) — échoue dans cet
  environnement (`ERROR: Playwright does not support chromium on mac13`),
  documenté honnêtement dans le rapport plutôt que contourné ou passé sous
  silence.
- **Règle 3 (tests)** : `pnpm typecheck` / `pnpm lint` re-vérifiés verts
  après le correctif `/auth/error`.
