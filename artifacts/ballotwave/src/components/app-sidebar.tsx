import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Vote, Users, BarChart3, LogOut, Settings, Building, Flag, ShieldCheck, ClipboardList, UserCircle, Phone, Bell, DollarSign, Tag, FileText, Percent } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { NotificationsPanel } from "@/components/notifications-panel";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const superAdminItems = [
    { title: "Schools", url: "/dashboard/schools", icon: Building2 },
    { title: "Revenue", url: "/dashboard/revenue", icon: DollarSign },
    { title: "Invoices", url: "/dashboard/invoices", icon: FileText },
    { title: "Promo Codes", url: "/dashboard/promos", icon: Tag },
    { title: "Payout Settings", url: "/dashboard/settings/payouts", icon: Percent },
    { title: "Platform Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    { title: "Audit Log", url: "/dashboard/audit", icon: ClipboardList },
    { title: "Settings", url: "/dashboard/settings", icon: Settings },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
  ];

  const schoolAdminItems = [
    { title: "Elections", url: "/dashboard/elections", icon: Vote },
    { title: "Users", url: "/dashboard/users", icon: Users },
    { title: "Departments", url: "/dashboard/departments", icon: Building },
    { title: "Disputes", url: "/dashboard/disputes", icon: Flag },
    { title: "USSD Setup", url: "/dashboard/ussd-config", icon: Phone },
    { title: "Notifications", url: "/dashboard/notifications/center", icon: Bell },
    { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    { title: "Audit Log", url: "/dashboard/audit", icon: ClipboardList },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
  ];

  const electoralOfficerItems = [
    { title: "Elections", url: "/dashboard/elections", icon: Vote },
    { title: "Disputes", url: "/dashboard/disputes", icon: Flag },
    { title: "Notifications", url: "/dashboard/notifications/center", icon: Bell },
    { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
  ];

  const observerItems = [
    { title: "Elections", url: "/dashboard/elections", icon: Vote },
    { title: "Disputes", url: "/dashboard/disputes", icon: Flag },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
  ];

  const voterItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Verify Vote", url: "/verify-vote", icon: ShieldCheck },
    { title: "Disputes", url: "/dashboard/disputes", icon: Flag },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
  ];

  let items = voterItems;
  if (user.role === 'super_admin') items = superAdminItems;
  else if (user.role === 'school_admin') items = schoolAdminItems;
  else if (user.role === 'electoral_officer') items = electoralOfficerItems;
  else if (user.role === 'observer') items = observerItems;

  const roleDisplayMap: Record<string, string> = {
    super_admin: "Super Admin",
    school_admin: "School Admin",
    electoral_officer: "Electoral Officer",
    observer: "Observer",
    candidate: "Candidate",
    voter: "Voter",
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-sidebar-foreground">BallotWave</span>
          </Link>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-semibold tracking-wider uppercase">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location === item.url || location.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}
                    >
                      <Link href={item.url}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-bold shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</span>
            <span className="text-xs text-sidebar-foreground/50">{roleDisplayMap[user.role] || user.role}</span>
          </div>
          <NotificationsPanel />
        </div>
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs text-sidebar-foreground/50 font-medium">Appearance</span>
          <ThemeToggle className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 h-8 w-8" />
        </div>
        <SidebarMenuButton onClick={() => logout()} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
          <LogOut className="w-5 h-5" />
          <span>Log out</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
