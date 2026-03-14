import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Flag, CheckCircle, Clock, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchDisputes(electionId?: string) {
  const params = new URLSearchParams();
  if (electionId) params.set("electionId", electionId);
  const res = await fetch(`${BASE}/api/disputes?${params}`);
  if (!res.ok) throw new Error("Failed to fetch disputes");
  return res.json();
}

async function createDispute(data: any) {
  const res = await fetch(`${BASE}/api/disputes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to submit dispute");
  }
  return res.json();
}

async function resolveDispute(id: string, data: any) {
  const res = await fetch(`${BASE}/api/disputes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update dispute");
  return res.json();
}

const disputeSchema = z.object({
  electionId: z.string().min(1, "Election ID required"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(10, "Please provide more details"),
});

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "Open", icon: Clock, color: "bg-amber-100 text-amber-700" },
  investigating: { label: "Investigating", icon: Flag, color: "bg-blue-100 text-blue-700" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "bg-emerald-100 text-emerald-700" },
  dismissed: { label: "Dismissed", icon: XCircle, color: "bg-gray-100 text-gray-700" },
};

interface DisputesPageProps {
  electionId?: string;
  showReporter?: boolean;
}

export default function DisputesPage({ electionId, showReporter = true }: DisputesPageProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resolvingDispute, setResolvingDispute] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const [resolveStatus, setResolveStatus] = useState<"investigating" | "resolved" | "dismissed">("resolved");

  const canManage = user?.role === "super_admin" || user?.role === "school_admin" || user?.role === "electoral_officer";

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["disputes", electionId],
    queryFn: () => fetchDisputes(electionId),
  });

  const createMutation = useMutation({
    mutationFn: createDispute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      setIsCreateOpen(false);
      form.reset();
      toast.success("Dispute submitted successfully");
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit dispute"),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => resolveDispute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      setResolvingDispute(null);
      toast.success("Dispute updated");
    },
    onError: () => toast.error("Failed to update dispute"),
  });

  const form = useForm<z.infer<typeof disputeSchema>>({
    resolver: zodResolver(disputeSchema),
    defaultValues: { electionId: electionId || "", subject: "", description: "" },
  });

  const onSubmit = (data: z.infer<typeof disputeSchema>) => createMutation.mutate(data);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dispute Log</h1>
          <p className="text-muted-foreground mt-1">Report and manage voting issues and irregularities.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-xl h-11 px-5 border-amber-300 text-amber-700 hover:bg-amber-50">
              <Flag className="w-4 h-4 mr-2" /> Report Issue
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Report a Voting Issue</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              {!electionId && (
                <div className="space-y-2">
                  <Label>Election ID</Label>
                  <Input {...form.register("electionId")} className="rounded-xl font-mono" placeholder="Paste the election ID..." />
                  {form.formState.errors.electionId && <p className="text-xs text-red-500">{form.formState.errors.electionId.message}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input {...form.register("subject")} className="rounded-xl" placeholder="Brief summary of the issue..." />
                {form.formState.errors.subject && <p className="text-xs text-red-500">{form.formState.errors.subject.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Details</Label>
                <Textarea {...form.register("description")} className="rounded-xl" rows={4} placeholder="Describe what happened in detail..." />
                {form.formState.errors.description && <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>}
              </div>
              <Button type="submit" className="w-full rounded-xl h-11" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Dispute
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : !disputes?.length ? (
        <div className="py-16 text-center bg-card rounded-2xl border border-dashed border-border">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="font-bold text-lg">No Disputes</h3>
          <p className="text-muted-foreground text-sm">No voting issues have been reported.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: any) => {
            const cfg = statusConfig[d.status] || statusConfig.open;
            const Icon = cfg.icon;
            return (
              <Card key={d.id} className="p-5 rounded-2xl border-border/50 shadow-sm">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      {showReporter && d.reportedByName && (
                        <span className="text-xs text-muted-foreground">by {d.reportedByName}</span>
                      )}
                    </div>
                    <h4 className="font-semibold text-foreground">{d.subject}</h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                    {d.resolution && (
                      <div className="mt-2 bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground">
                        <span className="font-medium">Resolution:</span> {d.resolution}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                  {canManage && d.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg shrink-0"
                      onClick={() => { setResolvingDispute(d); setResolution(""); setResolveStatus("resolved"); }}
                    >
                      Manage
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!resolvingDispute} onOpenChange={(o) => !o && setResolvingDispute(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Manage Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="font-medium text-sm">{resolvingDispute?.subject}</p>
              <p className="text-xs text-muted-foreground mt-1">{resolvingDispute?.description}</p>
            </div>
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={resolveStatus} onValueChange={(v: any) => setResolveStatus(v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Mark as Investigating</SelectItem>
                  <SelectItem value="resolved">Mark as Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismiss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Note (optional)</Label>
              <Textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                className="rounded-xl"
                rows={3}
                placeholder="Explain what action was taken..."
              />
            </div>
            <Button
              className="w-full rounded-xl h-11"
              disabled={resolveMutation.isPending}
              onClick={() => resolvingDispute && resolveMutation.mutate({
                id: resolvingDispute.id,
                data: { status: resolveStatus, resolution: resolution || undefined }
              })}
            >
              {resolveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
