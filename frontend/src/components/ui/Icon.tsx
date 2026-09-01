import {
  AlarmClock,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Baby,
  BarChart2,
  Bell,
  Bike,
  Book,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Cake,
  Calendar,
  CalendarDays,
  Camera,
  Car,
  Cat,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  Cookie,
  Crown,
  Dog,
  Droplet,
  Dumbbell,
  Edit2,
  Ellipsis,
  Eye,
  EyeOff,
  Flame,
  Flower2,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Glasses,
  GraduationCap,
  Headphones,
  Heart,
  HeartPulse,
  Home,
  Info,
  Laptop,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Mail,
  Monitor,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Music,
  Package,
  Palette,
  Palmtree,
  PartyPopper,
  Pencil,
  Pill,
  PiggyBank,
  Plane,
  Plus,
  PlusCircle,
  Scissors,
  Settings,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Tv,
  Umbrella,
  Users,
  Utensils,
  WashingMachine,
  Watch,
  Wifi,
  Wallet,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { IconName } from 'lucide-react/dynamic';

// Every icon name actually referenced anywhere in the app — nav/header
// chrome, the envelope and savings-goal icon pickers, seeded tip data,
// notifications, onboarding, the homepage. Statically imported by name
// (tree-shaken — unused lucide icons don't ship) instead of the previous
// `DynamicIcon` from 'lucide-react/dynamic'.
//
// Why the switch: `DynamicIcon` renders `null` until its own per-icon
// dynamic import resolves (see lucide-react's DynamicIcon.mjs — the icon
// node starts `undefined` and is only fetched inside a `useEffect`). With
// 5-8 icons rendering at once on every page — bottom nav, header, cards —
// that meant every icon popped in separately right after first paint,
// each one its own async gap. It read as the whole page's buttons/icons
// visibly jumping into place, worse under dev-mode's per-chunk
// compilation. The app's icon set is small and finite, so static imports
// cost a few KB more in the bundle and buy synchronous, jump-free icons.
//
// `IconName` still comes from 'lucide-react/dynamic' (type-only — erased
// at compile time, no runtime cost) so every existing `i="..."` call site
// keeps working unchanged. Add a new icon here (import + map entry) the
// day a new one is actually used; the dev-only warning below catches a
// forgotten entry immediately instead of silently rendering nothing.
const ICONS: Partial<Record<IconName, LucideIcon>> = {
  'alarm-clock': AlarmClock,
  'alert-triangle': AlertTriangle,
  'arrow-down-left': ArrowDownLeft,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  baby: Baby,
  'bar-chart-2': BarChart2,
  bell: Bell,
  bike: Bike,
  book: Book,
  'book-open': BookOpen,
  briefcase: Briefcase,
  'building-2': Building2,
  bus: Bus,
  cake: Cake,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  camera: Camera,
  car: Car,
  cat: Cat,
  check: Check,
  'check-circle': CheckCircle,
  'check-circle-2': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  clock: Clock,
  coffee: Coffee,
  cookie: Cookie,
  crown: Crown,
  dog: Dog,
  droplet: Droplet,
  dumbbell: Dumbbell,
  'edit-2': Edit2,
  ellipsis: Ellipsis,
  eye: Eye,
  'eye-off': EyeOff,
  flame: Flame,
  'flower-2': Flower2,
  footprints: Footprints,
  fuel: Fuel,
  'gamepad-2': Gamepad2,
  gift: Gift,
  glasses: Glasses,
  'graduation-cap': GraduationCap,
  headphones: Headphones,
  heart: Heart,
  'heart-pulse': HeartPulse,
  home: Home,
  info: Info,
  laptop: Laptop,
  'layout-dashboard': LayoutDashboard,
  lightbulb: Lightbulb,
  lock: Lock,
  mail: Mail,
  monitor: Monitor,
  moon: Moon,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  music: Music,
  package: Package,
  palette: Palette,
  palmtree: Palmtree,
  'party-popper': PartyPopper,
  pencil: Pencil,
  pill: Pill,
  'piggy-bank': PiggyBank,
  plane: Plane,
  plus: Plus,
  'plus-circle': PlusCircle,
  scissors: Scissors,
  settings: Settings,
  shield: Shield,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  stethoscope: Stethoscope,
  sun: Sun,
  target: Target,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  trophy: Trophy,
  tv: Tv,
  umbrella: Umbrella,
  users: Users,
  utensils: Utensils,
  'washing-machine': WashingMachine,
  watch: Watch,
  wifi: Wifi,
  wallet: Wallet,
  wrench: Wrench,
  x: X,
  zap: Zap,
};

export type { IconName };

interface IconProps {
  /** Icon name in lucide's kebab-case registry, e.g. "alert-triangle". */
  i: IconName;
  size?: number;
  className?: string;
}

/** Static icon lookup — see the ICONS comment above for why this replaced
 * the lazy `DynamicIcon`. A name missing from the map (an old envelope/goal
 * icon value from before the current picker list, most likely) falls back
 * to `Wallet` — a generic-but-present icon — rather than an empty box:
 * silently rendering nothing reads as broken, a wrong-but-visible icon
 * doesn't. The dev-only warning still fires so the gap gets noticed and
 * fixed (add the real icon here), not just papered over. */
export function Icon({ i, size = 20, className }: IconProps) {
  const Component = ICONS[i];
  if (!Component) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[Icon] "${i}" isn't in the static ICONS map — add it in components/ui/Icon.tsx.`,
      );
    }
    return <Wallet size={size} className={className} aria-hidden="true" />;
  }
  return <Component size={size} className={className} aria-hidden="true" />;
}
