import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetElection, useListCandidates, useCreateCandidate, useStartElection, useCloseElection, getGetElectionQueryKey, getListCandidatesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, ArrowLeft, PlayCircle, StopCircle, BarChart2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";

const createCandidateSchema = z.object({
  name: z.string().min(2),
  position: z.string().min(2),
  department: z.string().optional(),
  manifesto: z.string().optional(),
});

export default function ElectionDetail() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  
  const { data: election, isLoading: electionLoading } = useGetElection(id);
  const { data: candidates, isLoading: candidatesLoading } = useListCandidates(id);
  
  const createCandidateMutation = useCreateCandidate();
  const startMutation = useStartElection();
  const closeMutation = useCloseElection();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createCandidateSchema>>({
    resolver: zodResolver(createCandidateSchema),
    defaultValues: { name: "", position: "", department: "", manifesto: "" }
  });

  const onSubmit = async (data: z.infer<typeof createCandidateSchema>) => {
    await createCandidateMutation.mutateAsync({ electionId: id, data: data as any });
    queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
    setIsDialogOpen(false);
    form.reset();
  };

  const handleStart = async () => {
    await startMutation.mutateAsync({ electionId: id });
    queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
  };

  const handleClose = async () => {
    await closeMutation.mutateAsync({ electionId: id });
    queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
  };

  if (electionLoading || !election) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/elections">
        <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary mb-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Elections
        </Button>
      </Link>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={election.status} />
            <h1 className="text-2xl font-display font-bold text-foreground">{election.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(election.startDate).toLocaleString()} - {new Date(election.endDate).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/elections/${id}/results`}>
            <Button variant="outline" className="rounded-xl border-2">
              <BarChart2 className="w-4 h-4 mr-2" /> Live Results
            </Button>
          </Link>
          {election.status === 'draft' && (
            <Button onClick={handleStart} disabled={startMutation.isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PlayCircle className="w-4 h-4 mr-2" /> Start Election</>}
            </Button>
          )}
          {election.status === 'active' && (
            <Button onClick={handleClose} disabled={closeMutation.isPending} variant="destructive" className="rounded-xl">
              {closeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><StopCircle className="w-4 h-4 mr-2" /> End Election</>}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="candidates" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="overview" className="rounded-lg px-6">Overview</TabsTrigger>
          <TabsTrigger value="candidates" className="rounded-lg px-6">Candidates</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg px-6">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="candidates" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-foreground">Registered Candidates</h3>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-md shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Add Candidate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Candidate</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Candidate Name</Label>
                    <Input {...form.register("name")} className="rounded-xl" placeholder="Full Name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input {...form.register("position")} className="rounded-xl" placeholder="e.g. President" />
                  </div>
                  <div className="space-y-2">
                    <Label>Department/Course (Optional)</Label>
                    <Input {...form.register("department")} className="rounded-xl" placeholder="Computer Science" />
                  </div>
                  <div className="space-y-2">
                    <Label>Short Manifesto (Optional)</Label>
                    <Textarea {...form.register("manifesto")} className="rounded-xl resize-none" rows={3} placeholder="Candidate's vision..." />
                  </div>
                  <div className="pt-4">
                    <Button type="submit" className="w-full h-11 rounded-xl" disabled={createCandidateMutation.isPending}>
                      {createCandidateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Candidate"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {candidatesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates?.map(c => (
                <Card key={c.id} className="p-6 rounded-2xl flex items-center gap-4 border-border/50 hover:border-primary/30 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-inner">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground text-lg truncate">{c.name}</h4>
                    <p className="text-sm text-primary font-medium">{c.position}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{c.department || "No department specified"}</p>
                  </div>
                </Card>
              ))}
              {(!candidates || candidates.length === 0) && (
                <div className="col-span-full py-16 text-center bg-card rounded-2xl border border-dashed border-border">
                  <p className="text-muted-foreground">No candidates registered for this election.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        <TabsContent value="overview">
          <Card className="p-6 rounded-2xl">
             <p className="text-muted-foreground">Election details overview goes here.</p>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="p-6 rounded-2xl">
             <p className="text-muted-foreground">Advanced settings panel goes here.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
