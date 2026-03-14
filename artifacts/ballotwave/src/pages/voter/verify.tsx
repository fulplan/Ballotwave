import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Vote, CheckCircle2, XCircle, ArrowLeft, Search, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function VerifyVotePage() {
  const [electionId, setElectionId] = useState("");
  const [receiptCode, setReceiptCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!electionId.trim() || !receiptCode.trim()) {
      setError("Please enter both the Election ID and Receipt Code.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/elections/${electionId.trim()}/verify/${receiptCode.trim().toUpperCase()}`);
      if (!res.ok) throw new Error("Verification failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Something went wrong. Please check your inputs and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-5 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">BallotWave</span>
            </div>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="rounded-xl h-9 px-4 text-sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">Verify Your Vote</h1>
            <p className="text-muted-foreground mt-2">Confirm your ballot was counted — anonymously and securely.</p>
          </div>

          <Card className="p-6 rounded-2xl border-border/50 shadow-sm space-y-4">
            <div className="space-y-2">
              <Label>Election ID</Label>
              <Input
                value={electionId}
                onChange={e => setElectionId(e.target.value)}
                className="rounded-xl font-mono"
                placeholder="Paste the election ID here..."
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt Code</Label>
              <Input
                value={receiptCode}
                onChange={e => setReceiptCode(e.target.value.toUpperCase())}
                className="rounded-xl font-mono tracking-widest text-lg"
                placeholder="BW-XXXXX-XXXX"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              className="w-full h-12 rounded-xl text-base font-semibold shadow-md shadow-primary/20"
              onClick={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2"><Search className="w-4 h-4 animate-pulse" /> Verifying...</span>
              ) : (
                <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Verify Receipt</span>
              )}
            </Button>
          </Card>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {result.verified ? (
                  <Card className="p-6 rounded-2xl border-emerald-200 bg-emerald-50 shadow-sm">
                    <div className="flex items-start gap-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-lg text-emerald-900">Vote Confirmed!</h3>
                        <p className="text-sm text-emerald-700 mt-1">{result.message}</p>
                        <div className="mt-3 space-y-1 text-sm text-emerald-800">
                          <p><span className="font-medium">Receipt:</span> <code className="bg-emerald-100 px-1 rounded">{result.receiptCode}</code></p>
                          {result.votedAt && (
                            <p><span className="font-medium">Voted at:</span> {new Date(result.votedAt).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-6 rounded-2xl border-red-200 bg-red-50 shadow-sm">
                    <div className="flex items-start gap-4">
                      <XCircle className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-lg text-red-900">Not Found</h3>
                        <p className="text-sm text-red-700 mt-1">{result.message}</p>
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-xs text-muted-foreground">
            Your identity is never revealed during verification. This process only confirms your vote was counted.
          </p>
        </div>
      </main>
    </div>
  );
}
