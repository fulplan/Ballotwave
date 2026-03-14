import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetElection, useListCandidates, useCastVote, useCheckVoted, useInitiatePayment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, ShieldCheck, CreditCard, Lock, WifiOff, Wifi, FileText, UserPlus, ThumbsUp, ThumbsDown, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const OFFLINE_QUEUE_KEY = "ballotwave_offline_votes";

interface CandidateWithMedia {
  id: string;
  name: string;
  position: string;
  department?: string;
  manifesto?: string;
  manifestoPdfUrl?: string;
  videoUrl?: string;
  photoUrl?: string;
}

export default function VotePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();

  const { data: election, isLoading: electionLoading } = useGetElection(id);
  const { data: candidates, isLoading: candidatesLoading } = useListCandidates(id);
  const { data: voteStatus, isLoading: statusLoading } = useCheckVoted(id);
  
  const castVoteMutation = useCastVote();
  const initiatePaymentMutation = useInitiatePayment();

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [rankings, setRankings] = useState<Record<string, Record<string, number>>>({});
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [voteQueued, setVoteQueued] = useState(false);
  const [manifestoCandidate, setManifestoCandidate] = useState<CandidateWithMedia | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const queued = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
      const pending = queued.filter((q: any) => q.electionId === id);
      if (pending.length > 0) {
        toast({ title: "Back online!", description: "Submitting your queued vote..." });
        for (const q of pending) {
          try {
            const res = await castVoteMutation.mutateAsync({ electionId: q.electionId, data: { votes: q.votes } as any });
            setSuccessReceipt((res as any).receiptCode);
            const updated = queued.filter((item: any) => item.ref !== q.ref);
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
            setVoteQueued(false);
          } catch {}
        }
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [id]);

  if (electionLoading || candidatesLoading || statusLoading) {
    return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!election || election.status !== 'active') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Election Not Active</h1>
        <Button onClick={() => setLocation('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  if (voteStatus?.hasVoted || successReceipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-border">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Vote Recorded</h2>
          <p className="text-muted-foreground mb-6">Your vote has been securely recorded on the platform.</p>
          <div className="bg-muted/50 rounded-xl p-4 mb-8 text-left">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Receipt Code</p>
            <p className="font-mono font-bold text-lg text-foreground break-all">{successReceipt || voteStatus?.receiptCode}</p>
          </div>
          <Button onClick={() => setLocation('/dashboard')} className="w-full h-12 rounded-xl text-lg">Return to Dashboard</Button>
        </motion.div>
      </div>
    );
  }

  const electionType = (election as any).electionType || "standard";
  const votingMethod = (election as any).votingMethod || "fptp";
  const isReferendum = electionType === "referendum";
  const isRanked = votingMethod === "ranked_choice";
  const referendumQuestion = (election as any).referendumQuestion || election.title;

  const positions = Array.from(new Set((candidates || []).map(c => c.position)));

  let canSubmit = false;
  if (isReferendum) {
    canSubmit = !!selections["referendum"];
  } else if (isRanked) {
    canSubmit = positions.every(pos => {
      const posCandidates = candidates?.filter(c => c.position === pos) || [];
      const posRankings = rankings[pos] || {};
      return posCandidates.every(c => posRankings[c.id] !== undefined);
    });
  } else {
    canSubmit = positions.every(pos => selections[pos]);
  }

  const handleCandidateSelect = (position: string, candidateId: string) => {
    setSelections(prev => ({ ...prev, [position]: candidateId }));
  };

  const handleRankChange = (position: string, candidateId: string, direction: "up" | "down") => {
    const posCandidates = candidates?.filter(c => c.position === position) || [];
    const n = posCandidates.length;
    const posRankings = { ...(rankings[position] || {}) };

    if (Object.keys(posRankings).length === 0) {
      posCandidates.forEach((c, i) => { posRankings[c.id] = i + 1; });
    }

    const currentRank = posRankings[candidateId];
    if (direction === "up" && currentRank > 1) {
      const swapId = Object.entries(posRankings).find(([, r]) => r === currentRank - 1)?.[0];
      if (swapId) {
        posRankings[swapId] = currentRank;
        posRankings[candidateId] = currentRank - 1;
      }
    } else if (direction === "down" && currentRank < n) {
      const swapId = Object.entries(posRankings).find(([, r]) => r === currentRank + 1)?.[0];
      if (swapId) {
        posRankings[swapId] = currentRank;
        posRankings[candidateId] = currentRank + 1;
      }
    }

    setRankings(prev => ({ ...prev, [position]: posRankings }));
  };

  const initRankingsForPosition = (position: string) => {
    if (rankings[position]) return;
    const posCandidates = candidates?.filter(c => c.position === position) || [];
    const initial: Record<string, number> = {};
    posCandidates.forEach((c, i) => { initial[c.id] = i + 1; });
    setRankings(prev => ({ ...prev, [position]: initial }));
  };

  const handleVoteSubmitClick = () => {
    if (isRanked) {
      positions.forEach(pos => initRankingsForPosition(pos));
    }
    if (election.requiresPayment) {
      setIsPaymentModalOpen(true);
    } else {
      executeVote();
    }
  };

  const buildVotesArray = () => {
    if (isReferendum) {
      const chosenId = selections["referendum"];
      const refPosition = (candidates || [])[0]?.position || referendumQuestion;
      return [{ position: refPosition, candidateId: chosenId }];
    }
    if (isRanked) {
      const votesArr: { position: string; candidateId: string; rankOrder: number }[] = [];
      positions.forEach(pos => {
        const posRankings = rankings[pos] || {};
        if (Object.keys(posRankings).length === 0) {
          const posCandidates = candidates?.filter(c => c.position === pos) || [];
          posCandidates.forEach((c, i) => {
            votesArr.push({ position: pos, candidateId: c.id, rankOrder: i + 1 });
          });
        } else {
          Object.entries(posRankings).forEach(([candidateId, rankOrder]) => {
            votesArr.push({ position: pos, candidateId, rankOrder });
          });
        }
      });
      return votesArr;
    }
    return Object.entries(selections).map(([position, candidateId]) => ({ position, candidateId }));
  };

  const handlePaymentAndVote = async () => {
    setIsProcessingPayment(true);
    try {
      const initRes = await initiatePaymentMutation.mutateAsync({
        data: {
          electionId: id,
          email: user?.email || 'voter@example.com',
          amount: election.votingFee || 0,
          paymentMethod: "mobile_money",
          mobileMoneyProvider: "mtn"
        } as any
      });

      const { reference, authorizationUrl } = initRes as any;
      const isDemo = authorizationUrl?.includes("simulated");

      if (isDemo) {
        await new Promise(res => setTimeout(res, 2500));
        const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
        const verifyRes = await fetch(`${BASE}/api/payments/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) throw new Error("Payment verification failed");
        await executeVote(reference);
      } else {
        const popup = window.open(authorizationUrl, "_blank", "width=600,height=700");
        let attempts = 0;
        const maxAttempts = 60;
        const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
        await new Promise<void>((resolve, reject) => {
          const poll = setInterval(async () => {
            attempts++;
            try {
              const verifyRes = await fetch(`${BASE}/api/payments/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference }),
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                clearInterval(poll);
                popup?.close();
                await executeVote(reference);
                resolve();
              } else if (attempts >= maxAttempts) {
                clearInterval(poll);
                popup?.close();
                reject(new Error("Payment timed out. Please try again."));
              }
            } catch (e) {
              if (attempts >= maxAttempts) {
                clearInterval(poll);
                reject(e);
              }
            }
          }, 3000);
        });
      }
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessingPayment(false);
      setIsPaymentModalOpen(false);
    }
  };

  const executeVote = async (paymentRef?: string) => {
    const votesArray = buildVotesArray();
    if (!navigator.onLine) {
      const queueRef = `vote-${id}-${Date.now()}`;
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
      queue.push({ ref: queueRef, electionId: id, votes: votesArray, paymentRef, queuedAt: new Date().toISOString() });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      setVoteQueued(true);
      toast({ title: "Vote Queued", description: "No internet connection. Your vote will be submitted automatically when you're back online." });
      return;
    }
    try {
      const res = await castVoteMutation.mutateAsync({ 
        electionId: id, 
        data: { votes: votesArray, paymentReference: paymentRef } as any
      });
      setSuccessReceipt(res.receiptCode);
      toast({ title: "Success", description: "Your vote has been cast." });
    } catch (e: any) {
      if (!navigator.onLine) {
        const queueRef = `vote-${id}-${Date.now()}`;
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
        queue.push({ ref: queueRef, electionId: id, votes: votesArray, paymentRef, queuedAt: new Date().toISOString() });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        setVoteQueued(true);
        toast({ title: "Vote Queued", description: "Network error. Your vote will be submitted when connectivity is restored." });
      } else {
        toast({ title: "Voting Failed", description: e.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      {!isOnline && (
        <div className="bg-amber-500 text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          You are offline. {voteQueued ? "Your vote is queued and will be submitted when connectivity is restored." : "Votes will be saved and submitted when you reconnect."}
        </div>
      )}
      {isOnline && voteQueued && (
        <div className="bg-emerald-500 text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4" />
          Back online! Submitting your queued vote...
        </div>
      )}
      <header className="bg-primary text-primary-foreground py-6 px-4 shadow-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">{election.title}</h1>
            <p className="text-primary-foreground/80 flex items-center gap-1 mt-1 text-sm">
              <ShieldCheck className="w-4 h-4" /> Secure Voting Portal
              {isReferendum && <Badge className="ml-2 bg-white/20 text-white text-[10px] border-0">Referendum</Badge>}
              {isRanked && <Badge className="ml-2 bg-white/20 text-white text-[10px] border-0">Ranked Choice</Badge>}
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-white rounded-xl">Cancel</Button>
          </Link>
        </div>
      </header>

      {(election as { nominationsOpen?: boolean }).nominationsOpen && (
        <div className="bg-violet-500 text-white text-sm font-semibold text-center py-2.5 px-4 flex items-center justify-center gap-2">
          <UserPlus className="w-4 h-4" />
          Nominations are open for this election!
          <Link href={`/dashboard/elections/${id}?tab=nominations`}>
            <Button size="sm" variant="secondary" className="ml-2 h-7 text-xs rounded-lg bg-white/20 hover:bg-white/30 text-white border-0">
              Nominate Yourself
            </Button>
          </Link>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-4 mt-8 space-y-12">
        {isReferendum ? (
          <ReferendumBallot
            question={referendumQuestion}
            candidates={candidates || []}
            selection={selections["referendum"]}
            onSelect={(candidateId) => setSelections({ referendum: candidateId })}
            onViewManifesto={(c) => setManifestoCandidate(c as CandidateWithMedia)}
          />
        ) : isRanked ? (
          positions.map((position, idx) => {
            const posCandidates = candidates?.filter(c => c.position === position) || [];
            const posRankings = rankings[position] || {};
            const hasRankings = Object.keys(posRankings).length > 0;
            const displayCandidates = hasRankings
              ? [...posCandidates].sort((a, b) => (posRankings[a.id] || 99) - (posRankings[b.id] || 99))
              : posCandidates;
            return (
              <RankedBallotSection
                key={position}
                index={idx}
                position={position}
                candidates={displayCandidates}
                rankings={posRankings}
                onRankChange={(candidateId, direction) => handleRankChange(position, candidateId, direction)}
                onInit={() => initRankingsForPosition(position)}
                onViewManifesto={(c) => setManifestoCandidate(c as CandidateWithMedia)}
              />
            );
          })
        ) : (
          positions.map((position, idx) => {
            const positionCandidates = candidates?.filter(c => c.position === position) || [];
            return (
              <section key={position} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-border pb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">{idx + 1}</div>
                  <h2 className="text-2xl font-bold text-foreground">{position}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {positionCandidates.map(candidate => {
                    const isSelected = selections[position] === candidate.id;
                    return (
                      <Card 
                        key={candidate.id}
                        onClick={() => handleCandidateSelect(position, candidate.id)}
                        className={`p-4 cursor-pointer transition-all duration-200 border-2 rounded-2xl flex items-center gap-4
                          ${isSelected ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border hover:border-primary/40'}`}
                      >
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {candidate.photoUrl ? (
                            <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold text-muted-foreground">{candidate.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-foreground">{candidate.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">{candidate.department || "Independent"}</p>
                          {(candidate.manifesto || (candidate as CandidateWithMedia).manifestoPdfUrl) && (
                            <button
                              className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                              onClick={(e) => { e.stopPropagation(); setManifestoCandidate(candidate as CandidateWithMedia); }}
                            >
                              <FileText className="w-3 h-3" /> View Manifesto
                            </button>
                          )}
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                          ${isSelected ? 'border-primary bg-primary text-white' : 'border-muted-foreground/30'}`}>
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {!isReferendum && (
            <div className="hidden sm:block">
              {isRanked ? (
                <p className="font-medium text-foreground text-sm">Drag or use arrows to rank candidates</p>
              ) : (
                <p className="font-medium text-foreground">Positions Selected: <span className="text-primary font-bold">{Object.keys(selections).length} / {positions.length}</span></p>
              )}
            </div>
          )}
          <Button 
            size="lg" 
            className="w-full sm:w-auto px-12 h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/25"
            disabled={!canSubmit || castVoteMutation.isPending}
            onClick={handleVoteSubmitClick}
          >
            {castVoteMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "Cast My Ballot"}
          </Button>
        </div>
      </div>

      <Dialog open={!!manifestoCandidate} onOpenChange={() => setManifestoCandidate(null)}>
        <DialogContent className="sm:max-w-3xl w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> {manifestoCandidate?.name}'s Manifesto
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1">
              Running for <span className="font-medium text-foreground">{manifestoCandidate?.position}</span>
              {manifestoCandidate?.department && <> &middot; {manifestoCandidate.department}</>}
            </p>
            {manifestoCandidate?.manifestoPdfUrl && (manifestoCandidate.manifestoPdfUrl.startsWith("data:application/pdf") || manifestoCandidate.manifestoPdfUrl.startsWith("https://")) && (
              <iframe
                src={manifestoCandidate.manifestoPdfUrl}
                className="w-full h-[60vh] rounded-xl border border-border mt-3"
                title="Manifesto PDF"
                sandbox="allow-same-origin"
              />
            )}
            {manifestoCandidate?.manifesto && (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed mt-3">
                {manifestoCandidate?.manifesto}
              </div>
            )}
            {manifestoCandidate?.videoUrl && (
              <div className="mt-3">
                <a href={manifestoCandidate.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                  🎬 Watch Campaign Video
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl text-center p-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl mb-2">Secure Payment Required</DialogTitle>
          <p className="text-muted-foreground mb-6">
            This election requires a fee of <strong className="text-foreground">{election.currency} {election.votingFee}</strong> to cast a ballot.
          </p>
          <div className="bg-muted/50 rounded-xl p-4 mb-6">
            <p className="text-sm mb-2">You will be redirected to Paystack to complete your payment securely.</p>
            <div className="flex items-center justify-center gap-2 font-bold text-xl text-primary">
              <CreditCard className="w-6 h-6" /> {election.currency} {election.votingFee}
            </div>
          </div>
          <Button onClick={handlePaymentAndVote} disabled={isProcessingPayment} className="w-full h-14 text-lg rounded-xl">
            {isProcessingPayment ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing payment...</> : "Pay & Cast Vote"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReferendumBallot({ question, candidates, selection, onSelect, onViewManifesto }: {
  question: string;
  candidates: any[];
  selection: string | undefined;
  onSelect: (id: string) => void;
  onViewManifesto: (c: any) => void;
}) {
  const yesCandidate = candidates.find(c => c.name === "Yes");
  const noCandidate = candidates.find(c => c.name === "No");

  return (
    <section className="space-y-6">
      <div className="bg-card border border-border/50 rounded-2xl p-6 text-center shadow-sm">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-primary" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Referendum Question</p>
        <h2 className="text-2xl font-display font-bold text-foreground leading-tight">{question}</h2>
        <p className="text-muted-foreground mt-2 text-sm">Cast your vote by selecting Yes or No below</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {yesCandidate && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              onClick={() => onSelect(yesCandidate.id)}
              className={`p-8 cursor-pointer transition-all duration-200 border-2 rounded-2xl text-center
                ${selection === yesCandidate.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10"
                  : "border-border hover:border-emerald-400/60"}`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors
                ${selection === yesCandidate.id ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                <ThumbsUp className="w-8 h-8" />
              </div>
              <h3 className={`text-3xl font-display font-bold mb-1 ${selection === yesCandidate.id ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>Yes</h3>
              <p className="text-sm text-muted-foreground">I support this proposal</p>
              {selection === yesCandidate.id && (
                <div className="mt-3 flex items-center justify-center gap-1 text-emerald-600 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Selected
                </div>
              )}
            </Card>
          </motion.div>
        )}
        {noCandidate && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              onClick={() => onSelect(noCandidate.id)}
              className={`p-8 cursor-pointer transition-all duration-200 border-2 rounded-2xl text-center
                ${selection === noCandidate.id
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30 shadow-lg shadow-red-500/10"
                  : "border-border hover:border-red-400/60"}`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors
                ${selection === noCandidate.id ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}>
                <ThumbsDown className="w-8 h-8" />
              </div>
              <h3 className={`text-3xl font-display font-bold mb-1 ${selection === noCandidate.id ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>No</h3>
              <p className="text-sm text-muted-foreground">I oppose this proposal</p>
              {selection === noCandidate.id && (
                <div className="mt-3 flex items-center justify-center gap-1 text-red-600 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Selected
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function RankedBallotSection({ index, position, candidates, rankings, onRankChange, onInit, onViewManifesto }: {
  index: number;
  position: string;
  candidates: any[];
  rankings: Record<string, number>;
  onRankChange: (candidateId: string, direction: "up" | "down") => void;
  onInit: () => void;
  onViewManifesto: (c: any) => void;
}) {
  const hasRankings = Object.keys(rankings).length > 0;

  useEffect(() => {
    onInit();
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">{index + 1}</div>
        <h2 className="text-2xl font-bold text-foreground">{position}</h2>
        <Badge variant="secondary" className="text-[10px] ml-auto">Drag to Rank</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Use the arrows to rank candidates from most to least preferred. #1 is your top choice.</p>
      <div className="space-y-3">
        {candidates.map((candidate, idx) => {
          const rank = rankings[candidate.id] ?? (idx + 1);
          const n = candidates.length;
          return (
            <motion.div
              key={candidate.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="p-4 rounded-2xl border border-border/50 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-lg
                  ${rank === 1 ? "bg-primary text-white" : rank === 2 ? "bg-primary/70 text-white" : rank === 3 ? "bg-primary/40 text-white" : "bg-muted text-muted-foreground"}`}>
                  {rank}
                </div>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {candidate.photoUrl ? (
                    <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">{candidate.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">{candidate.name}</h3>
                  <p className="text-xs text-muted-foreground">{candidate.department || "Independent"}</p>
                  {(candidate.manifesto || candidate.manifestoPdfUrl) && (
                    <button
                      className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-1"
                      onClick={() => onViewManifesto(candidate)}
                    >
                      <FileText className="w-3 h-3" /> View Manifesto
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => onRankChange(candidate.id, "up")}
                    disabled={rank === 1}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Move up (higher preference)"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRankChange(candidate.id, "down")}
                    disabled={rank === n}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Move down (lower preference)"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
