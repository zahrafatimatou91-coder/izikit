// Static curated Tips content (decision: not AI-generated — see
// .planning/banani/00-roadmap.md and tips.md). This is real app content
// meant for every environment, not a dev-only fixture — unlike seed-dev.ts,
// this script is NOT gated behind NODE_ENV !== production.
//
// Idempotent — upserts keyed on `title`, so running multiple times does not
// duplicate rows.
//
// Usage: pnpm seed:tips

import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

interface SeedTip {
  title: string;
  icon: string;
  category: string;
  estimatedSavingsFcfa: number;
  body: string;
}

const SEED_TIPS: SeedTip[] = [
  {
    title: 'Transport malin',
    icon: 'bike',
    category: 'transport',
    estimatedSavingsFcfa: 2400,
    body: [
      'Analyse tes trajets réguliers. Identifie les trajets quotidiens ou hebdomadaires que tu fais habituellement en moto-taxi. Note les distances et les coûts.',
      'Explore les alternatives. Regarde les transports en commun (bus, mini-bus, gare routière). Compare les prix et les temps de trajet. Teste de nouveaux itinéraires.',
      'Planifie un calendrier. Identifie les jours où tu peux utiliser le transport en commun. Garde le moto-taxi pour les urgences ou trajets courts.',
      "Partage les trajets. Coordonne-toi avec d'autres étudiants pour partager les moto-taxis sur certains trajets. Cela réduit aussi les coûts.",
    ].join('\n\n'),
  },
  {
    title: 'Repas planifiés',
    icon: 'utensils',
    category: 'nourriture',
    estimatedSavingsFcfa: 3500,
    body: [
      "Planifie tes repas de la semaine avant d'aller au marché. Une liste précise évite les achats impulsifs et les doublons.",
      "Achète en gros ce qui se conserve (riz, huile, légumineuses) avec d'autres étudiants pour profiter de meilleurs prix.",
      "Cuisine en plus grande quantité et garde des portions pour les jours chargés — ça évite d'acheter à l'extérieur par manque de temps.",
    ].join('\n\n'),
  },
  {
    title: 'Loisirs groupés',
    icon: 'music',
    category: 'loisirs',
    estimatedSavingsFcfa: 750,
    body: [
      "Organise tes sorties (cinéma, bar, discothèque) avec un groupe fixe d'amis — les frais de transport et certaines offres se partagent mieux à plusieurs.",
      'Repère les soirées à tarif réduit (étudiant, avant 20h, journée spéciale) proposées par les lieux que tu fréquentes déjà.',
      'Fixe-toi un budget loisirs mensuel avant de sortir, plutôt que de décider sur place.',
    ].join('\n\n'),
  },
  {
    title: 'Partage logement',
    icon: 'home',
    category: 'loyer',
    estimatedSavingsFcfa: 5000,
    body: [
      "Explore les options de colocation avec d'autres étudiants — un logement partagé réduit fortement le loyer et les charges par personne.",
      "Compare les logements proches de ton lieu d'études pour réduire aussi les frais de transport en plus du loyer.",
      'Négocie les charges communes (eau, électricité, internet) dès la signature pour éviter les mauvaises surprises.',
    ].join('\n\n'),
  },
  {
    title: 'Abonnements reviews',
    icon: 'smartphone',
    category: 'abonnements',
    estimatedSavingsFcfa: 2000,
    body: [
      'Liste tous tes abonnements actifs (téléphone, streaming, applications) et note ce que tu utilises vraiment chaque mois.',
      "Résilie ou mets en pause ceux que tu n'utilises plus, et regarde si un forfait partagé avec des amis revient moins cher.",
      'Reviens sur cette liste chaque trimestre — les besoins et les offres changent vite.',
    ].join('\n\n'),
  },
  {
    title: "Fonds d'urgence",
    icon: 'piggy-bank',
    category: 'épargne',
    estimatedSavingsFcfa: 2500,
    body: [
      'Économise 5% de chaque revenu dans une enveloppe séparée, avant même de penser au reste de ton budget.',
      'Ne touche à ce fonds que pour un vrai imprévu (santé, urgence familiale) — pas pour une envie du moment.',
      'Commence petit : même 500 F par semaine construit une vraie réserve sur quelques mois.',
    ].join('\n\n'),
  },
  {
    title: 'Santé optimisée',
    icon: 'heart',
    category: 'santé',
    estimatedSavingsFcfa: 1500,
    body: [
      "Utilise les cliniques étudiantes gratuites ou à tarif réduit pour les consultations de base, avant d'aller directement en clinique privée.",
      "Demande systématiquement la version générique d'un médicament à la pharmacie — même efficacité, prix souvent bien plus bas.",
      'Renseigne-toi sur les mutuelles ou assurances étudiantes disponibles dans ton établissement.',
    ].join('\n\n'),
  },
  {
    title: 'Études économes',
    icon: 'book',
    category: 'scolarité',
    estimatedSavingsFcfa: 2200,
    body: [
      'Partage les photocopies et supports de cours avec tes camarades plutôt que de payer chaque impression individuellement.',
      "Emprunte les livres à la bibliothèque ou achète-les d'occasion auprès d'étudiants des années précédentes.",
      "Regarde les ressources gratuites en ligne (cours, exercices) avant d'acheter un manuel supplémentaire.",
    ].join('\n\n'),
  },
  {
    title: 'Objectifs clairs',
    icon: 'target',
    category: 'objectifs',
    estimatedSavingsFcfa: 10000,
    body: [
      "Fixe-toi un objectif d'épargne précis et chiffré pour le mois, plutôt qu'une intention vague d'« économiser plus ».",
      'Suis ta progression chaque semaine — voir le chiffre avancer est ce qui maintient la motivation sur la durée.',
      "Découpe les gros objectifs en petites étapes atteignables : c'est plus facile de tenir 4 semaines à 2 500 F qu'un mois à 10 000 F d'un coup.",
    ].join('\n\n'),
  },
];

interface SeedDeps {
  prisma?: PrismaClient;
}

export async function main(_args: string[] = [], deps: SeedDeps = {}): Promise<void> {
  const prisma = deps.prisma ?? new PrismaClient();
  try {
    for (const tip of SEED_TIPS) {
      await prisma.tip.upsert({
        where: { title: tip.title },
        update: {
          icon: tip.icon,
          category: tip.category,
          estimatedSavingsFcfa: tip.estimatedSavingsFcfa,
          body: tip.body,
        },
        create: tip,
      });
      console.log(`✓ ${tip.title}`);
    }
  } finally {
    if (!deps.prisma) {
      await prisma.$disconnect();
    }
  }
}

// Compares resolved file:// URLs (not raw string concat) so paths
// containing spaces or other URL-reserved characters still match —
// import.meta.url percent-encodes them, a naive `file://${argv[1]}` does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
