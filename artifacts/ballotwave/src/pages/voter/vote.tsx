import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetElection, useListCandidates, useCastVote, useCheckVoted, useInitiatePayment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, ShieldCheck, CreditCard, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

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

  // state: { "President": "candidateId_123", "Secretary": "candidateId_456" }
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);

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

  const positions = Array.from(new Set((candidates || []).map(c => c.position)));
  const canSubmit = positions.every(pos => selections[pos]);

  const handleCandidateSelect = (position: string, candidateId: string) => {
    setSelections(prev => ({ ...prev, [position]: candidateId }));
  };

  const handleVoteSubmitClick = () => {
    if (election.requiresPayment) {
      setIsPaymentModalOpen(true);
    } else {
      executeVote();
    }
  };

  const simulatePaymentAndVote = async () => {
    setIsProcessingPayment(true);
    try {
      // 1. Initiate (mock)
      const initRes = await initiatePaymentMutation.mutateAsync({
        data: {
          electionId: id,
          email: user?.email || 'voter@example.com',
          amount: election.votingFee || 0,
          paymentMethod: "mobile_money",
          mobileMoneyProvider: "mtn"
        } as any
      });
      // 2. Simulate user confirming on phone (delay)
      await new Promise(res => setTimeout(res, 2000));
      
      // 3. Cast vote with reference
      await executeVote(initRes.reference);
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessingPayment(false);
      setIsPaymentModalOpen(false);
    }
  };

  const executeVote = async (paymentRef?: string) => {
    try {
      const votesArray = Object.entries(selections).map(([position, candidateId]) => ({ position, candidateId }));
      const res = await castVoteMutation.mutateAsync({ 
        electionId: id, 
        data: { votes: votesArray, paymentReference: paymentRef } as any
      });
      setSuccessReceipt(res.receiptCode);
      toast({ title: "Success", description: "Your vote has been cast." });
    } catch (e: any) {
      toast({ title: "Voting Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-primary text-primary-foreground py-6 px-4 shadow-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">{election.title}</h1>
            <p className="text-primary-foreground/80 flex items-center gap-1 mt-1 text-sm">
              <ShieldCheck className="w-4 h-4" /> Secure Voting Portal
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-white rounded-xl">Cancel</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-8 space-y-12">
        {positions.map((position, idx) => {
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
        })}

        <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="font-medium text-foreground">Positions Selected: <span className="text-primary font-bold">{Object.keys(selections).length} / {positions.length}</span></p>
            </div>
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
      </main>

      {/* Payment Dialog */}
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
            <p className="text-sm mb-2">We will send a prompt to your Mobile Money number to approve the payment.</p>
            <div className="flex items-center justify-center gap-2 font-bold text-xl text-primary">
              <CreditCard className="w-6 h-6" /> {election.currency} {election.votingFee}
            </div>
          </div>
          <Button onClick={simulatePaymentAndVote} disabled={isProcessingPayment} className="w-full h-14 text-lg rounded-xl">
            {isProcessingPayment ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Waiting for approval...</> : "Pay & Cast Vote"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
