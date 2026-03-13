import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Landing from "./pages/landing";
import AuthPage from "./pages/auth";
import DashboardHome from "./pages/dashboard/index";
import SchoolsPage from "./pages/dashboard/schools";
import ElectionsPage from "./pages/dashboard/elections";
import ElectionDetail from "./pages/dashboard/election-detail";
import AnalyticsPage from "./pages/dashboard/analytics";
import SettingsPage from "./pages/dashboard/settings";
import VotePage from "./pages/voter/vote";
import ResultsPage from "./pages/shared/results";
import NotFound from "./pages/not-found";
import { DashboardLayout } from "./components/layout";

// Setup global fetch interceptor to append JWT token
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
    if (path !== '/login' && path !== '/' && path !== '/register') {
      window.location.href = '/login';
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/login"><AuthPage isRegister={false} /></Route>
            <Route path="/register"><AuthPage isRegister={true} /></Route>
            <Route path="/vote/:id" component={VotePage} />
            
            {/* Dashboard Routes wrapped in layout */}
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
            
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
