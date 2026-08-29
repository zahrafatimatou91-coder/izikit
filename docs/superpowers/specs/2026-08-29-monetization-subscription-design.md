# Monétisation : paliers, écran d'abonnement et refonte du hero de la landing page

Statut : validé en discussion, en attente de relecture avant plan d'implémentation.
Date : 2026-08-29

## Contexte

"Chaque Franc" a un modèle Prisma `Subscription` (`plan: FREE|PLUS|PRO`, `status`,
`currentPeriodEnd`, `lastOrderId`) déjà en base mais aucune route ni page ne
l'utilise. Ce document fixe ce qui doit exister : les paliers, l'écran de
gestion d'abonnement, et la refonte du hero de la landing page (jugée trop
générique et "moche" par la porteuse du projet).

Trois chantiers, dépendants dans cet ordre : les paliers (1) déterminent le
contenu de l'écran d'abonnement (2) et de la section tarifs de la landing page
(3).

## Chantier 1 — Paliers et tarifs

**Deux paliers seulement : Free et Pro.** Le champ `plan` du modèle
`Subscription` reste `FREE|PLUS|PRO` tel quel (aucune migration nécessaire) —
`PLUS` n'est simplement jamais assigné pour l'instant, réservé pour une
extension future.

### Free (gratuit)

- Transactions : création illimitée, toujours.
- Historique visible : limité au mois en cours + mois précédent. Au-delà,
  message "Passe à Pro pour voir tout ton historique."
- Enveloppes : 2 maximum.
- Objectifs d'épargne : 0 — fonctionnalité 100% réservée à Pro.
- Tableau de bord : complet, sans restriction.
- Notifications : dépassement d'enveloppe uniquement.
- Tendances et Conseils personnalisés : verrouillés.

### Pro (payant)

- Tout en illimité : enveloppes, objectifs d'épargne, historique.
- Accès à Tendances et Conseils personnalisés.
- Toutes les notifications (rappels, jalons d'objectifs, rythme d'épargne
  manqué, etc.).
- Prix : 1 500 FCFA/mois, ou 13 500 FCFA/an (équivalent à 3 mois offerts —
  9 mois payés sur 12, soit 25% de réduction par rapport au tarif mensuel).

### Pourquoi ces limites précisément

- La création de transactions n'est **jamais** bloquée : empêcher quelqu'un de
  noter une dépense casse la promesse de base d'une app de budget et pousse à
  l'abandon plutôt qu'à l'achat. Le levier commercial porte sur la
  *visibilité* de l'historique, pas sur l'usage quotidien.
- Les objectifs d'épargne à 0 en Free (plutôt qu'un quota réduit) donnent un
  argument de vente positif et clair : "passe à Pro pour commencer à
  épargner", pas juste "pour en avoir plus".

### Renouvellement — modèle "pass", pas prélèvement automatique

Bictorys agrège essentiellement du mobile money (Wave, Orange Money, Free
Money) qui ne permet pas de prélèvement automatique silencieux — l'utilisateur
confirme chaque paiement depuis son téléphone. Promettre un renouvellement
automatique serait donc mensonger pour la majorité des paiements.

Modèle retenu : l'utilisateur paie pour une période (mois ou an), reste Pro
jusqu'à `Subscription.currentPeriodEnd`, reçoit une notification de rappel
**3 jours avant l'échéance**, et repasse automatiquement en Free à
l'échéance s'il n'a pas renouvelé (voir Downgrade ci-dessous).

### Downgrade — jamais de suppression de données

Quand un utilisateur Pro repasse en Free avec plus d'enveloppes/objectifs que
la limite Free : le surplus (les plus anciens par date de création) passe en
statut **archivé** — visible mais gelé (non modifiable, ne compte pas dans les
nouvelles limites) — jamais supprimé. Tout redevient actif d'un coup dès que
l'utilisateur repasse en Pro. Aucun choix forcé ("supprime 3 enveloppes pour
continuer") n'est présenté à l'utilisateur au moment du downgrade.

**Impact modèle de données** : `Envelope` et `SavingsGoal` ont besoin d'un flag
d'archivage (ex. `archivedAt: DateTime?`) qui n'existe pas aujourd'hui.

## Chantier 2 — Écran /subscription

### Comment l'utilisateur y arrive

Une seule page centrale (`/subscription`, liée depuis Paramètres) gère tout :
statut actuel, changement de plan, annulation, comparatif Free/Pro. Partout
ailleurs où une limite Free est atteinte, un petit rappel contextuel renvoie
vers cette page plutôt que d'ouvrir un paywall dédié par fonctionnalité
(plus simple à livrer et à maintenir qu'un système de paywalls multiples) :

- Enveloppes à la limite : "Limite Free atteinte (2/2) — passe à Pro pour en
  ajouter"
- Objectifs d'épargne : "Réservé à Pro — passe à Pro pour commencer à
  épargner"
- Tendances / Conseils personnalisés : "Fonctionnalité Pro"
- Historique au-delà de 2 mois : "Passe à Pro pour voir tout ton historique"

### Contenu de la page

**Bandeau de statut** (en haut, dépend de l'état) :
- Free : "Tu es sur le plan Free"
- Pro actif : "Tu es Pro jusqu'au [date]" + lien "Annuler mon abonnement"
- Pro expiré : "Ton abonnement Pro a expiré le [date] — repasse en Pro pour
  tout débloquer à nouveau"

**Accroche** :
> Passe à Pro et commence à épargner
> Enveloppes illimitées, objectifs d'épargne, tendances et conseils
> personnalisés — tout ce qu'il te faut pour garder le contrôle, un franc à
> la fois.

**Tableau comparatif** (Free | Pro) : Enveloppes (2 max | illimitées),
Objectifs d'épargne (— | illimités), Historique (2 derniers mois | complet),
Tendances (— | ✓), Conseils personnalisés (— | ✓), Notifications (dépassement
uniquement | toutes).

**Facturation** : toggle Mensuel (1 500 FCFA/mois) / Annuel (13 500 FCFA/an,
badge "3 mois offerts") → bouton "Passer à Pro".

**FAQ courte** :
- *Puis-je annuler quand je veux ?* → Oui, tu restes Pro jusqu'à la fin de la
  période payée, puis tu repasses en Free.
- *Je perds mes données si je repasse en Free ?* → Non, jamais. Le surplus
  est archivé, pas supprimé — tout revient si tu repasses en Pro.
- *Comment je paie ?* → Wave, Orange Money, Free Money ou carte.

**Contrainte de copywriting non-négociable** : ne jamais qualifier les
Conseils personnalisés d'"IA" — c'est du contenu statique/curé avec
correspondance par mots-clés, pas de l'intelligence artificielle (piège déjà
identifié dans le suivi Banani `.planning/banani/STATUS.md`).

### Implications techniques (à vérifier en phase de plan)

- Réutilise `Order` + `PaymentProvider` (Bictorys) comme prévu dans
  `.planning/banani/STATUS.md` Phase 6 — le schéma actuel du modèle `Order`
  n'a pas été relu dans cette conception ; vérifier à l'implémentation s'il
  faut un discriminant (`kind`/`purpose`) pour distinguer un paiement
  d'abonnement d'un autre type de commande.
- Nouveau cron `subscription-expiration` (même famille que `order-expiration`
  déjà existant) : détecte `currentPeriodEnd < now` sur les abonnements
  `ACTIVE`, repasse le plan en `FREE`, déclenche l'archivage du surplus,
  émet une notification via l'outbox. Tourne quotidiennement ; un second
  passage (ou une requête dédiée dans le même cron) déclenche le rappel à
  `currentPeriodEnd - 3 jours`.
- Deux nouveaux templates de notification à ajouter dans
  `notifications/templates.ts` (avec `dedupeKey`) : rappel de renouvellement
  (3 jours avant `currentPeriodEnd`) et confirmation d'expiration.
- Un helper de vérification de palier (dans l'esprit des HOF `requireAuth`
  existants) doit gater : création d'enveloppe au-delà de 2, création
  d'objectif d'épargne, accès aux routes Tendances/Conseils, et filtrer
  l'historique par date pour les comptes Free.

## Chantier 3 — Landing page

### Ce qui ne change pas

La section qui montre un aperçu du tableau de bord est déjà appréciée et
reste en l'état. Les couleurs et polices du reste de l'app (`--color-primary:
#1e6b45`, `--color-secondary: #f5c842`, `--color-background: #faf7f2`, DM Sans
+ Space Grotesk) restent la seule source de vérité — pas de nouvelle palette.

### Diagnostic

Trois problèmes concrets repérés dans `frontend/src/app/page.tsx` :
1. Icônes Lucide dans des carrés à fond dégradé plein
   (`bg-gradient-to-br from-primary to-secondary`) sur les 4 cartes de la
   section Fonctionnalités — le motif le plus reconnaissable de tout template
   SaaS générique.
2. Un dégradé bleu codé en dur (`#2563eb`) dans le fond de la carte solde du
   mockup de dashboard et dans le fond du hero (`from-blue-50`) — ne
   correspond à aucune couleur de la palette réelle de l'app.
3. Structure hero → logos → grille de fonctionnalités → étapes → témoignages
   → CTA → footer : le squelette par défaut de toute landing page générée
   automatiquement.
4. La liste de moyens de paiement affichée (`MTN MoMo`, `Orange Money`,
   `Wave`, `Airtel Money`) ne correspond pas aux rails réellement supportés
   par Bictorys d'après CLAUDE.md (Wave, Orange Money, Free Money, carte) —
   `MTN MoMo` et `Airtel Money` semblent inexacts et doivent être corrigés
   pour ne pas afficher une fausse promesse.

### Hero — design validé

Le hero doit avoir un fond **distinct et plus riche** que l'intérieur épuré
de l'app, sans que le vert (déjà omniprésent à l'intérieur) domine — le vert
devient un accent (uniquement le bouton CTA), pas la couleur de fond.

- **Fond** : `linear-gradient(160deg, #4a3c28 0%, #2e2417 100%)` — brun chaud
  moyen (ni noir profond, jugé trop sombre, ni vert).
- **Accent** : or (`#f5c842`) sur le mot clé du titre et le nom de marque.
- **Texte** : ivoire (`#faf7f2`) pour le corps, blanc pour le titre.
- **CTA** : bouton vert plein (`#1e6b45`) — seul usage du vert dans le hero,
  délibérément, pour qu'il reste l'accent "action".
- **Élément décoratif** : une seule lueur douce ivoire en radial-gradient à
  faible opacité, ancrée dans un coin vide (jamais superposée à du texte).
- **Icônes de fonctionnalités** (Enveloppes, Objectifs) : badge arrondi à
  fond teinté or translucide + bordure, icône trait ivoire — jamais un carré
  plein à dégradé. Les deux badges ont le **même traitement visuel** (les
  deux fonctionnalités sont positives et parallèles, pas un état budgétaire) —
  pas de couleur différenciée entre elles, pas de numérotation 01/02.

**Copywriting validé** :
- Titre : "Sais où part chaque franc, avant la fin du mois."
- Sous-titre : "Tu ranges ton argent en enveloppes dès qu'il rentre. L'app te
  dit ce qu'il reste dans chacune, en temps réel."
- Réassurance sous le CTA : "Sans carte bancaire · Actif en 5 minutes"
  (reprend une promesse déjà utilisée plus bas sur la page, donc vérifiable).

**Aperçu produit dans le hero** (remplace le mockup de dashboard actuel, dont
le dégradé bleu doit disparaître) : un total "Reste ce mois-ci" en FCFA, 3
lignes d'enveloppes avec barres de progression (Nourriture, Transport,
Famille), et une ligne d'objectif d'épargne. **Exactement 2 lignes vertes et
1 ambre, jamais de rouge** — le premier contact ne doit pas être anxiogène ;
une démonstration de l'état d'alerte (rouge) a sa place plus bas dans le
produit, pas dans le hero.

**Règle de couleur non-négociable, appliquée dans tout le hero** :
- Rouge réservé aux vraies alertes (dépassement, solde négatif, erreur) —
  jamais décoratif, jamais sur un CTA ou un numéro.
- Vert = action / état positif.
- Or/ambre = soit un accent de marque décoratif (hors contexte budgétaire),
  soit l'indicateur "budget tendu" — **jamais les deux à la fois au même
  endroit** : à l'intérieur d'un indicateur d'état budgétaire (barre
  d'enveloppe, montant), l'or ne sert qu'à signaler "tendu", point. En dehors
  de ce contexte (titre, marque, bordures décoratives), l'or reste
  disponible comme couleur d'accent générale de la marque.

**Disposition desktop** : colonne gauche = marque, titre, sous-titre, les 2
fonctionnalités, CTA, réassurance. Colonne droite = aperçu produit (3
enveloppes + objectif).

**Disposition mobile (360px)** : titre → sous-titre → aperçu compact (2
enveloppes seulement, pas de ligne d'objectif) → CTA + réassurance → les 2
fonctionnalités. Le CTA doit rester atteignable dans le premier écran visible
à 360px — à reconfirmer sur le rendu réel une fois implémenté (l'estimation
faite sur la maquette est favorable mais pas mesurée en conditions réelles).

### Reste de la page — même langage, pas de nouvelle décision de design

Le fond sombre est réservé au hero (effet ponctuel) ; le reste de la page
garde le fond clair/ivoire habituel de l'app. Seule règle à appliquer
partout : plus aucune icône dans un carré à fond dégradé plein — même
traitement "badge teinté + bordure + icône trait" que dans le hero, adapté
aux couleurs claires (ex. fond vert très clair + bordure verte + icône
verte). Concrètement :

- **Bande paiements** : corriger la liste (retirer MTN MoMo et Airtel Money,
  utiliser Wave / Orange Money / Free Money / carte), garder le style simple
  actuel (coche + libellé).
- **Fonctionnalités** : remplacer les 4 icônes-carrés-dégradés par le badge
  teinté+bordure. Structure de la grille inchangée.
- **Étapes ("4 étapes")** : contrairement à Enveloppes/Objectifs, c'est un
  vrai flux séquentiel (créer un compte → définir un budget → créer des
  enveloppes → atteindre ses objectifs) — la numérotation 01-04 reste
  légitime ici et n'est pas concernée par la règle "pas de numérotation".
- **Ajout d'une section Tarifs** (`#tarifs` existe déjà comme ancre dans la
  nav desktop mais n'a pas de contenu dédié) : reprend le tableau Free/Pro du
  chantier 1, avec des CTA vers l'inscription plutôt que vers le paiement
  ("Créer un compte gratuit" / "Commencer" — le visiteur n'a pas encore de
  compte, le paiement effectif se fait sur `/subscription` une fois connecté).
- **Témoignages, CTA final, footer** : hors scope de cette conception — pas
  de changement demandé au-delà de la cohérence de style générale. *Note
  signalée mais non traitée ici* : les témoignages actuels (noms, citations)
  semblent être des exemples fictifs plutôt que de vrais retours
  utilisateurs — à trancher séparément si l'app doit un jour les présenter
  comme authentiques.

## Hors scope (explicitement reporté)

- Refonte complète de toutes les sections de la landing page au même niveau
  de détail que le hero — seul le hero a été conçu en profondeur ; le reste
  suit la règle d'icônes ci-dessus mécaniquement.
- Palier intermédiaire "Plus" — le champ existe dans le schéma mais n'est pas
  utilisé.
- Prélèvement automatique récurrent (carte bancaire tokenisée) — le modèle
  "pass" manuel est retenu pour la v1 ; un vrai abonnement récurrent reste une
  option future si la part des paiements par carte devient significative.
- Revue de la page Paramètres — menée en parallèle par une autre session sur
  ce même dépôt, sans dépendance avec ce document.
