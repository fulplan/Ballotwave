import { Link, useLocation } from "wouter";
import { LayoutDashboard, Vote, UserCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Vote", url: "/vote", icon: Vote, matchPrefix: "/vote/" },
  { title: "Verify", url: "/verify-vote", icon: ShieldCheck },
  { title: "Profile", url: "/dashboard/profile", icon: UserCircle },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            location === item.url ||
            (item.matchPrefix ? location.startsWith(item.matchPrefix) : false);
          return (
            <Link key={item.title} href={item.url} className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <item.icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                <span className="text-[10px] font-semibold tracking-wide">{item.title}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
