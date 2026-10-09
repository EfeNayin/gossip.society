import { useEffect, useState } from "react";
import {
  createIcons,
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Award,
  Ban,
  BarChart2,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarClock,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  Coins,
  Crown,
  Download,
  Dumbbell,
  Edit2,
  Eye,
  FileText,
  Globe,
  Grid,
  Headset,
  Home,
  Image,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  MousePointerClick,
  PieChart,
  PlayCircle,
  Plus,
  PlusCircle,
  QrCode,
  Radar,
  Radio,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  StarHalf,
  Store,
  Target,
  Ticket,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Users2,
  Utensils,
  Video,
  X,
  Zap,
} from "lucide";
import LandingView from "./features/landing/LandingView";
import InfluencerRegistration from "./features/influencer/InfluencerRegistration";
import InfluencerApp from "./features/influencer/InfluencerApp";
import VenueApp from "./features/venue/VenueApp";
import AdminApp from "./features/admin/AdminApp";

const appIcons = {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Award,
  Ban,
  BarChart2,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarClock,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  Coins,
  Crown,
  Download,
  Dumbbell,
  Edit2,
  Eye,
  FileText,
  Globe,
  Grid,
  Headset,
  Home,
  Image,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  MousePointerClick,
  PieChart,
  PlayCircle,
  Plus,
  PlusCircle,
  QrCode,
  Radar,
  Radio,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  StarHalf,
  Store,
  Target,
  Ticket,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Users2,
  Utensils,
  Video,
  X,
  Zap,
};

window.lucide = {
  createIcons: () => createIcons({ icons: appIcons }),
};

function LoadingScreen() {
  return (
    <main className="flex h-full w-full items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-800 border-t-[#FF007F]" />
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
          Gossip Society
        </p>
      </div>
    </main>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const existingScript = document.querySelector('script[data-gossip-legacy="true"]');

    if (existingScript) {
      setIsReady(true);
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "/legacy-app.js";
    script.dataset.gossipLegacy = "true";
    script.onload = () => setIsReady(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    if (isReady) window.lucide.createIcons();
  }, [isReady]);

  if (!isReady) return <LoadingScreen />;

  return (
    <main
      id="app-container"
      className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-zinc-950 shadow-2xl"
    >
      <LandingView />
      <InfluencerRegistration />
      <InfluencerApp />
      <VenueApp />
      <AdminApp />
    </main>
  );
}
