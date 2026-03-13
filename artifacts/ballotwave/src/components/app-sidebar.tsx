import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Vote, Users, BarChart3, LogOut, Settings } from "lucide-react";
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

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const superAdminItems = [
    { title: "Schools", url: "/dashboard/schools", icon: Building2 },
    { title: "Platform Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    { title: "Settings", url: "/dashboard/settings", icon: Settings },
  ];

  const schoolAdminItems = [
    { title: "Elections", url: "/dashboard/elections", icon: Vote },
    { title: "Voters", url: "/dashboard/voters", icon: Users },
    { title: "School Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  ];

  const voterItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  ];

  let items = voterItems;
  if (user.role === 'super_admin') items = superAdminItems;
  if (user.role === 'school_admin') items = schoolAdminItems;

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
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground truncate max-w-[140px]">{user.name}</span>
            <span className="text-xs text-sidebar-foreground/50 capitalize">{user.role.replace('_', ' ')}</span>
          </div>
        </div>
        <SidebarMenuButton onClick={() => logout()} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
          <LogOut className="w-5 h-5" />
          <span>Log out</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
