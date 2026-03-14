import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "next-themes";

import Landing from "./pages/landing";
import AuthPage from "./pages/auth";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";
import DashboardHome from "./pages/dashboard/index";
import SchoolsPage from "./pages/dashboard/schools";
import ElectionsPage from "./pages/dashboard/elections";
import ElectionDetail from "./pages/dashboard/election-detail";
import AnalyticsPage from "./pages/dashboard/analytics";
import SettingsPage from "./pages/dashboard/settings";
import UsersPage from "./pages/dashboard/users";
import DepartmentsPage from "./pages/dashboard/departments";
import DisputesPage from "./pages/dashboard/disputes";
import ProfilePage from "./pages/dashboard/profile";
import AuditLogPage from "./pages/dashboard/audit";
import UssdConfigPage from "./pages/dashboard/ussd-config";
import NotificationCenter from "./pages/dashboard/notification-center";
import RevenueDashboard from "./pages/dashboard/revenue";
import PayoutSettingsPage from "./pages/dashboard/payout-settings";
import PromoCodesPage from "./pages/dashboard/promo-codes";
import InvoicesPage from "./pages/dashboard/invoices";
import VotePage from "./pages/voter/vote";
import VerifyVotePage from "./pages/voter/verify";
import ResultsPage from "./pages/shared/results";
import PublicResultsPage from "./pages/public/results";
import NotFound from "./pages/not-found";
import { DashboardLayout } from "./components/layout";

const PUBLIC_PATHS = ["/", "/login", "/register", "/verify-vote", "/forgot-password", "/reset-password"];

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  const token = localStorage.getItem("ballotwave_token");
  if (token) {
    if (config) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    } else {
      args[1] = { headers: { Authorization: `Bearer ${token}` } };
    }
  }
  const response = await originalFetch(...args);
  if (response.status === 401) {
    localStorage.removeItem("ballotwave_token");
    const path = window.location.pathname;
    const isPublicPath = PUBLIC_PATHS.some(p => path === p) || path.startsWith("/results/");
    if (!isPublicPath) {
      window.location.href = "/login";
    }
  }
  return response;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="ballotwave-theme">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/" component={Landing} />
              <Route path="/login"><AuthPage isRegister={false} /></Route>
              <Route path="/register"><AuthPage isRegister={true} /></Route>
              <Route path="/forgot-password" component={ForgotPasswordPage} />
              <Route path="/reset-password" component={ResetPasswordPage} />
              <Route path="/vote/:id" component={VotePage} />
              <Route path="/verify-vote" component={VerifyVotePage} />
              <Route path="/results/:slug" component={PublicResultsPage} />

              <Route path="/dashboard">
                <DashboardHome />
              </Route>
              <Route path="/dashboard/schools">
                <DashboardLayout><SchoolsPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/elections">
                <DashboardLayout><ElectionsPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/elections/:id">
                <DashboardLayout><ElectionDetail /></DashboardLayout>
              </Route>
              <Route path="/dashboard/elections/:id/results">
                <ResultsPage />
              </Route>
              <Route path="/dashboard/analytics">
                <DashboardLayout><AnalyticsPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/settings">
                <DashboardLayout><SettingsPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/users">
                <DashboardLayout><UsersPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/departments">
                <DashboardLayout><DepartmentsPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/disputes">
                <DashboardLayout><DisputesPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/profile">
                <DashboardLayout><ProfilePage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/audit">
                <DashboardLayout><AuditLogPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/ussd-config">
                <DashboardLayout><UssdConfigPage /></DashboardLayout>
              </Route>
              <Route path="/dashboard/notifications/center">
                <NotificationCenter />
              </Route>
              <Route path="/dashboard/revenue">
                <RevenueDashboard />
              </Route>
              <Route path="/dashboard/settings/payouts">
                <PayoutSettingsPage />
              </Route>
              <Route path="/dashboard/promos">
                <PromoCodesPage />
              </Route>
              <Route path="/dashboard/invoices">
                <InvoicesPage />
              </Route>

              <Route component={NotFound} />
            </Switch>
          </WouterRouter>
          <Toaster richColors position="top-right" theme="system" />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </ThemeProvider>
  );
}

export default App;
