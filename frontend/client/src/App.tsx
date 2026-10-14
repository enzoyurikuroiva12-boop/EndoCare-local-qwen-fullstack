import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthDialog } from "@/components/AuthDialog";
import { LibrasAccessibility } from "@/components/LibrasAccessibility";
import { AccountAccessGate } from "@/components/AccountAccessGate";
import { SiteMonitoring } from "@/components/SiteMonitoring";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SiteLanguageProvider } from "./contexts/SiteLanguageContext";
import { AccountControlProvider } from "./contexts/AccountControlContext";
import Admin from "./pages/Admin";
import AdminPunishmentLog from "./pages/AdminPunishmentLog";
import Blog from "./pages/Blog";
import Diary from "./pages/Diary";
import Home from "./pages/Home";
import QuestionnairePage from "./pages/QuestionnairePage";
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><SiteLanguageProvider><TooltipProvider><AccountControlProvider><Toaster /><AuthDialog /><LibrasAccessibility /><SiteMonitoring /><MaintenanceBanner /><AccountAccessGate><Switch><Route path="/" component={Home} /><Route path="/faq" component={FAQ} /><Route path="/termos" component={Terms} /><Route path="/privacidade" component={PrivacyPolicy} /><Route path="/diario" component={Diary} /><Route path="/blog" component={Blog} /><Route path="/questionario" component={QuestionnairePage} /><Route path="/admin/punicoes" component={AdminPunishmentLog} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></AccountAccessGate></AccountControlProvider></TooltipProvider></SiteLanguageProvider></ThemeProvider></ErrorBoundary>;
}
