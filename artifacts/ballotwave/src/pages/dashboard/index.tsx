import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useListElections } from "@workspace/api-client-react";
import { Loader2, Vote, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardHome() {
  const { user } = useAuth();
  
  if (user?.role === 'super_admin') return <Redirect to="/dashboard/schools" />;
  if (user?.role === 'school_admin') return <Redirect to="/dashboard/elections" />;

  // Voter dashboard logic
  const { data: elections, isLoading } = useListElections({ schoolId: user?.schoolId, status: 'active' });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">Here are the active elections you can participate in today.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(!elections || elections.length === 0) ? (
              <div className="col-span-full py-20 text-center bg-card rounded-3xl border border-dashed border-border">
                <Vote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-1">No Active Elections</h3>
                <p className="text-muted-foreground">There are no elections active for your institution right now.</p>
              </div>
            ) : (
              elections.map(election => (
                <Card key={election.id} className="p-8 rounded-3xl border-border/50 shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Vote className="w-6 h-6" />
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Active Now</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">{election.title}</h3>
                  <p className="text-muted-foreground mb-8 line-clamp-2">{election.description || "Cast your vote in the current election cycle."}</p>
                  
                  <Link href={`/vote/${election.id}`}>
                    <Button className="w-full h-12 rounded-xl text-lg font-semibold shadow-md shadow-primary/20 group-hover:-translate-y-0.5 transition-transform">
                      Enter Voting Portal <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
