import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Vote, Users, Percent, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Candidate {
  candidateId: string;
  name: string;
  photoUrl?: string;
  department?: string;
  voteCount: number;
  percentage: number;
}

interface PositionResult {
  position: string;
  candidates: Candidate[];
  winner: Candidate | null;
}

interface ResultsData {
  electionId: string;
  title: string;
  description?: string;
  status: string;
  totalVotes: number;
  registeredVoters: number;
  turnoutPercentage: number;
  positions: PositionResult[];
}

export default function PublicResultsPage() {
  const params = useParams();
  const slug = (params as any).slug as string;
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/elections/public/${slug}/results`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.message || "Failed to load results");
        setData(json);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500" />
        <h1 className="text-2xl font-bold text-foreground">Results Unavailable</h1>
        <p className="text-muted-foreground max-w-sm">{error || "This election's results have not been published yet."}</p>
        <Link href="/">
          <Button className="rounded-xl mt-2">Go to BallotWave</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Vote className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">BallotWave</span>
          </div>
          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Official Results
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">{data.title}</h1>
          {data.description && <p className="text-muted-foreground mt-2">{data.description}</p>}

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm text-center">
              <Vote className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{data.totalVotes.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Votes</p>
            </Card>
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm text-center">
              <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{data.registeredVoters.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Registered Voters</p>
            </Card>
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm text-center">
              <Percent className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{data.turnoutPercentage}%</p>
              <p className="text-sm text-muted-foreground">Voter Turnout</p>
            </Card>
          </div>
        </motion.div>

        <div className="space-y-8">
          {data.positions.map((posResult, pi) => (
            <motion.div key={posResult.position} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pi * 0.1 }}>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                {posResult.position}
              </h2>
              <div className="space-y-3">
                {posResult.candidates.map((candidate, ci) => {
                  const isWinner = posResult.winner?.candidateId === candidate.candidateId;
                  return (
                    <Card key={candidate.candidateId}
                      className={`p-4 rounded-2xl border-2 transition-colors ${isWinner ? "border-amber-300 bg-amber-50/50" : "border-border/50"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 font-bold text-lg text-muted-foreground">
                          {candidate.photoUrl ? (
                            <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                          ) : (
                            candidate.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{candidate.name}</span>
                            {isWinner && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <Trophy className="w-3 h-3" /> Winner
                              </span>
                            )}
                          </div>
                          {candidate.department && <p className="text-sm text-muted-foreground">{candidate.department}</p>}
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${isWinner ? "bg-amber-400" : "bg-primary/60"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${candidate.percentage}%` }}
                              transition={{ duration: 0.8, delay: pi * 0.1 + ci * 0.05 }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-foreground">{candidate.voteCount.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">{candidate.percentage}%</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Results verified and published by <span className="font-semibold text-foreground">BallotWave</span> — Secure Digital Voting for African Schools
          </p>
          <Link href="/">
            <Button variant="link" className="mt-2 text-primary">Visit BallotWave</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
