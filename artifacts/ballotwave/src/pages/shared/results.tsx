import { useParams, Link } from "wouter";
import { useGetElectionResults } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Trophy, Users, Percent, Download, Globe, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function publishResults(electionId: string) {
  const res = await fetch(`${BASE}/api/elections/${electionId}/publish-results`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to publish results");
  return res.json();
}

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: results, isLoading } = useGetElectionResults(id, {
    query: { refetchInterval: 5000 } // real-time updates every 5s
  });

  const publishMutation = useMutation({
    mutationFn: () => publishResults(id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Results have been published publicly!");
    },
    onError: () => toast.error("Failed to publish results"),
  });

  const handleExport = () => {
    window.open(`${BASE}/api/elections/${id}/results/export`, "_blank");
  };

  const canManage = user?.role === "super_admin" || user?.role === "school_admin" || user?.role === "electoral_officer";

  if (isLoading || !results) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/elections/${id}`}>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Live Results</h1>
              <p className="text-muted-foreground">{results.title} &bull; {results.status}</p>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport} className="rounded-xl h-10 px-4 text-sm">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              {!results.resultsPublished && results.status === "closed" && (
                <Button
                  className="rounded-xl h-10 px-4 text-sm shadow-md shadow-primary/20"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                >
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                  Publish Results
                </Button>
              )}
              {results.resultsPublished && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 font-medium">
                    <Globe className="w-4 h-4" /> Published
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9 px-3 text-sm"
                    onClick={() => {
                      const url = `${window.location.origin}${BASE}/results/${results.slug}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Public link copied to clipboard!");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Share Link
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 rounded-2xl border-border/50 bg-gradient-to-br from-primary to-emerald-600 text-white shadow-lg shadow-primary/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/80 font-medium mb-1">Total Votes Cast</p>
                <p className="text-4xl font-display font-bold">{results.totalVotes}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl"><Users className="w-6 h-6" /></div>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-border/50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Voter Turnout</p>
                <p className="text-4xl font-display font-bold text-foreground">{results.turnoutPercentage}%</p>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-xl"><Percent className="w-6 h-6" /></div>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-border/50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Registered Voters</p>
                <p className="text-4xl font-display font-bold text-foreground">{results.registeredVoters}</p>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-xl"><Users className="w-6 h-6" /></div>
            </div>
          </Card>
        </div>

        <div className="space-y-10">
          {results.positions.map((pos: any) => {
            const maxVotes = Math.max(...pos.candidates.map((c: any) => c.voteCount), 1);
            return (
              <div key={pos.position} className="space-y-4">
                <h3 className="text-2xl font-bold border-b border-border pb-2">{pos.position}</h3>
                <div className="grid grid-cols-1 gap-4">
                  {pos.candidates.sort((a: any, b: any) => b.voteCount - a.voteCount).map((candidate: any, i: number) => {
                    const isWinner = i === 0 && candidate.voteCount > 0 && results.status === 'closed';
                    const isLeading = i === 0 && candidate.voteCount > 0 && results.status === 'active';
                    return (
                      <div key={candidate.candidateId} className="bg-card p-5 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-center mb-3 relative z-10">
                          <div className="flex items-center gap-3">
                            {candidate.photoUrl ? (
                              <img src={candidate.photoUrl} className="w-10 h-10 rounded-full object-cover" alt={candidate.name} />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
                                {candidate.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-lg flex items-center gap-2">
                                {candidate.name}
                                {isWinner && <Trophy className="w-4 h-4 text-amber-500" />}
                                {isLeading && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-medium">Leading</span>}
                              </h4>
                              {candidate.department && <p className="text-sm text-muted-foreground">{candidate.department}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-2xl">{candidate.voteCount}</p>
                            <p className="text-sm text-muted-foreground">{candidate.percentage?.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden relative z-10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(candidate.voteCount / maxVotes) * 100}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
                          />
                        </div>
                        {isWinner && <div className="absolute inset-0 bg-amber-500/5 z-0 pointer-events-none" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
