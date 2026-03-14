import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useListElections } from "@workspace/api-client-react";
import { Vote, ArrowRight, Clock, CalendarClock, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/skeleton-cards";
import { EmptyState } from "@/components/empty-state";

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Starting now…"); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

function UpcomingCard({ election }: { election: any }) {
  const countdown = useCountdown(election.startDate);
  return (
    <Card className="p-6 rounded-2xl border-border/50 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
      <div className="flex justify-between items-start mb-4 pl-2">
        <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
          <Clock className="w-3 h-3" /> Upcoming
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(election.startDate).toLocaleDateString("en-GH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="pl-2">
        <h3 className="text-lg font-bold text-foreground mb-1">{election.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{election.description || "Coming soon — prepare to cast your vote."}</p>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-0.5">Starts in</p>
          <p className="text-xl font-bold font-mono text-amber-800 dark:text-amber-300">{countdown}</p>
        </div>
        {election.nominationsOpen && (
          <Link href={`/dashboard/elections/${election.id}?tab=nominations`}>
            <Button variant="outline" className="w-full mt-3 h-9 rounded-xl text-xs font-semibold border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Nominate Yourself
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function VoterDashboard() {
  const { user } = useAuth();
  const { data: activeElections, isLoading: loadingActive } = useListElections({ schoolId: user?.schoolId, status: 'active' });
  const { data: draftElections } = useListElections({ schoolId: user?.schoolId, status: 'draft' });

  const upcomingElections = (draftElections ?? []).filter((e: any) => new Date(e.startDate) > new Date());

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">Here are the elections available for you today.</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Vote className="w-5 h-5 text-primary" /> Active Elections
          </h2>
          {loadingActive ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (!activeElections || activeElections.length === 0) ? (
            <EmptyState
              icon={Vote}
              title="No Active Elections"
              description="There are no elections active for your institution right now. Check back later."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeElections.map((election: any) => (
                <Card key={election.id} className="p-8 rounded-3xl border-border/50 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                  <div className="flex justify-between items-start mb-6 pl-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Vote className="w-6 h-6" />
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Active Now</span>
                  </div>
                  <div className="pl-2">
                    <h3 className="text-2xl font-bold text-foreground mb-2">{election.title}</h3>
                    <p className="text-muted-foreground mb-8 line-clamp-2">{election.description || "Cast your vote in the current election cycle."}</p>
                    <div className="space-y-3">
                      <Link href={`/vote/${election.id}`}>
                        <Button className="w-full h-12 rounded-xl text-lg font-semibold shadow-md shadow-primary/20 group-hover:-translate-y-0.5 transition-transform">
                          Enter Voting Portal <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                      </Link>
                      {election.nominationsOpen && (
                        <Link href={`/dashboard/elections/${election.id}?tab=nominations`}>
                          <Button variant="outline" className="w-full h-10 rounded-xl text-sm font-semibold border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30">
                            <UserPlus className="w-4 h-4 mr-2" /> Nominate Yourself
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {upcomingElections.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-500" /> Upcoming Elections
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingElections.map((election: any) => (
                <UpcomingCard key={election.id} election={election} />
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();

  if (user?.role === 'super_admin') return <Redirect to="/dashboard/schools" />;
  if (user?.role === 'school_admin') return <Redirect to="/dashboard/elections" />;
  if (user?.role === 'electoral_officer') return <Redirect to="/dashboard/elections" />;
  if (user?.role === 'observer') return <Redirect to="/dashboard/elections" />;

  return <VoterDashboard />;
}
