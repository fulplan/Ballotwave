import { useState } from "react";
import { useListElections, useCreateElection } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Calendar as CalIcon, Users, CreditCard } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListElectionsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const createElectionSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  votingType: z.enum(["web", "ussd", "both"]),
  startDate: z.string(),
  endDate: z.string(),
  requiresPayment: z.boolean().default(false),
  votingFee: z.coerce.number().optional(),
  currency: z.string().default("GHS")
});

export default function ElectionsPage() {
  const { user } = useAuth();
  const { data: elections, isLoading } = useListElections({ schoolId: user?.schoolId });
  const createMutation = useCreateElection();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createElectionSchema>>({
    resolver: zodResolver(createElectionSchema),
    defaultValues: { title: "", votingType: "both", requiresPayment: false, currency: "GHS", votingFee: 0 }
  });

  const onSubmit = async (data: z.infer<typeof createElectionSchema>) => {
    if (!user?.schoolId) return;
    await createMutation.mutateAsync({ data: { ...data, schoolId: user.schoolId } as any });
    queryClient.invalidateQueries({ queryKey: getListElectionsQueryKey() });
    setIsDialogOpen(false);
    form.reset();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Elections Management</h1>
          <p className="text-muted-foreground mt-1">Create and monitor elections for your institution.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-md shadow-primary/20 rounded-xl px-6 h-11">
              <Plus className="w-5 h-5 mr-2" /> New Election
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Create Election</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Election Title</Label>
                <Input {...form.register("title")} className="rounded-xl" placeholder="e.g. 2024 SRC General Election" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time</Label>
                  <Input type="datetime-local" {...form.register("startDate")} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time</Label>
                  <Input type="datetime-local" {...form.register("endDate")} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Voting Channels</Label>
                  <Select onValueChange={(v) => form.setValue("votingType", v as any)} defaultValue="both">
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">Web Only</SelectItem>
                      <SelectItem value="ussd">USSD Only</SelectItem>
                      <SelectItem value="both">Web + USSD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Requires Payment?</Label>
                  <Select onValueChange={(v) => form.setValue("requiresPayment", v === "yes")} defaultValue="no">
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No (Free)</SelectItem>
                      <SelectItem value="yes">Yes (Paid)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.watch("requiresPayment") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Voting Fee Amount</Label>
                    <Input type="number" step="0.01" {...form.register("votingFee")} className="rounded-xl" placeholder="5.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input {...form.register("currency")} className="rounded-xl" placeholder="GHS" />
                  </div>
                </div>
              )}
              <div className="pt-4">
                <Button type="submit" className="w-full h-11 rounded-xl" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Election"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections?.length === 0 && (
            <div className="col-span-full text-center py-20 bg-card rounded-2xl border border-dashed border-border">
              <p className="text-muted-foreground">No elections found. Create one to get started.</p>
            </div>
          )}
          {elections?.map(election => (
            <Card key={election.id} className="p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all border-border/50 flex flex-col group">
              <div className="flex justify-between items-start mb-4">
                <StatusBadge status={election.status} />
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-1 rounded-md">
                  {election.votingType}
                </div>
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-2 line-clamp-2">{election.title}</h3>
              
              <div className="space-y-3 mt-auto pt-4 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalIcon className="w-4 h-4 text-primary/70" />
                  <span>{new Date(election.startDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary/70" />
                  <span>{election.totalCandidates} Candidates</span>
                </div>
                {election.requiresPayment && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">{election.currency} {election.votingFee} to vote</span>
                  </div>
                )}
              </div>

              <Link href={`/dashboard/elections/${election.id}`}>
                <Button className="w-full rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Manage Election
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
