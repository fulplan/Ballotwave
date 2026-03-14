import { useState, useCallback } from "react";
import { useListElections, useCreateElection } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Calendar as CalIcon, Users, CreditCard, Vote, Clock, Filter, Settings2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getListElectionsQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { SkeletonCard } from "@/components/skeleton-cards";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const YEAR_LEVELS = ["1", "2", "3", "4", "5", "6"];

const createElectionSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  votingType: z.enum(["web", "ussd", "both"]),
  electionType: z.enum(["standard", "referendum"]).default("standard"),
  votingMethod: z.enum(["fptp", "ranked_choice"]).default("fptp"),
  referendumQuestion: z.string().optional(),
  showLiveCount: z.boolean().default(true),
  startDate: z.string(),
  endDate: z.string(),
  requiresPayment: z.boolean().default(false),
  votingFee: z.coerce.number().optional(),
  currency: z.string().default("GHS"),
  registeredVoters: z.coerce.number().default(0),
});

function isScheduled(election: any) {
  return election.status === "draft" && new Date(election.startDate) > new Date();
}

export default function ElectionsPage() {
  const { user } = useAuth();
  const { data: elections, isLoading } = useListElections({ schoolId: user?.schoolId });
  const createMutation = useCreateElection();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedYearLevels, setSelectedYearLevels] = useState<string[]>([]);

  const { data: departments } = useQuery({
    queryKey: ["departments", user?.schoolId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/departments?schoolId=${user!.schoolId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ballotwave_token")}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.schoolId,
  });

  const form = useForm<z.infer<typeof createElectionSchema>>({
    resolver: zodResolver(createElectionSchema),
    defaultValues: { title: "", votingType: "both", electionType: "standard", votingMethod: "fptp", showLiveCount: true, requiresPayment: false, currency: "GHS", votingFee: 0, registeredVoters: 0 }
  });

  const watchElectionType = form.watch("electionType");
  const watchShowLiveCount = form.watch("showLiveCount");

  const toggleDept = useCallback((id: string) => {
    setSelectedDepts(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  }, []);

  const toggleYearLevel = useCallback((level: string) => {
    setSelectedYearLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
  }, []);

  const onSubmit = async (data: z.infer<typeof createElectionSchema>) => {
    if (!user?.schoolId) return;
    try {
      await createMutation.mutateAsync({
        data: {
          ...data,
          schoolId: user.schoolId,
          eligibleDepartments: selectedDepts.length > 0 ? selectedDepts : null,
          eligibleYearLevels: selectedYearLevels.length > 0 ? selectedYearLevels : null,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListElectionsQueryKey() });
      setIsDialogOpen(false);
      form.reset();
      setSelectedDepts([]);
      setSelectedYearLevels([]);
      toast.success("Election created successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create election");
    }
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
          <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Create Election</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Election Title</Label>
                <Input {...form.register("title")} className="rounded-xl" placeholder="e.g. 2024 SRC General Election" />
              </div>
              <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input {...form.register("description")} className="rounded-xl" placeholder="Brief description of the election" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time</Label>
                  <Input type="datetime-local" {...form.register("startDate")} className="rounded-xl" />
                  <p className="text-xs text-muted-foreground">Election auto-activates at this time.</p>
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time</Label>
                  <Input type="datetime-local" {...form.register("endDate")} className="rounded-xl" />
                  <p className="text-xs text-muted-foreground">Election auto-closes at this time.</p>
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

              <div className="border border-dashed border-border rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Advanced Election Settings
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Election Type</Label>
                    <Select onValueChange={(v) => form.setValue("electionType", v as any)} defaultValue="standard">
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard (Candidates)</SelectItem>
                        <SelectItem value="referendum">Referendum (Yes/No)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Referendum elections auto-create Yes/No choices.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Voting Method</Label>
                    <Select onValueChange={(v) => form.setValue("votingMethod", v as any)} defaultValue="fptp" disabled={watchElectionType === "referendum"}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fptp">First-Past-The-Post</SelectItem>
                        <SelectItem value="ranked_choice">Ranked Choice (IRV)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">IRV: voters rank candidates by preference.</p>
                  </div>
                </div>
                {watchElectionType === "referendum" && (
                  <div className="space-y-2">
                    <Label>Referendum Question <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Textarea
                      {...form.register("referendumQuestion")}
                      className="rounded-xl resize-none"
                      rows={2}
                      placeholder="e.g. Should the school introduce a new dress code policy?"
                    />
                    <p className="text-xs text-muted-foreground">This question will be prominently displayed to voters.</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Hide Live Vote Counts</p>
                    <p className="text-xs text-muted-foreground">When enabled, vote counts are hidden from voters until the election closes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => form.setValue("showLiveCount", !watchShowLiveCount)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${!watchShowLiveCount ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${!watchShowLiveCount ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Registered Voters</Label>
                <Input type="number" {...form.register("registeredVoters")} className="rounded-xl" placeholder="e.g. 500" />
                <p className="text-xs text-muted-foreground">Used to calculate voter turnout percentage.</p>
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

              <div className="border border-dashed border-border rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter className="w-4 h-4 text-primary" />
                  Voter Eligibility Filters
                  <span className="text-xs font-normal text-muted-foreground ml-1">— leave blank to allow all voters</span>
                </div>
                {departments && departments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Restrict to Departments</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {departments.map((dept: any) => (
                        <label key={dept.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={selectedDepts.includes(dept.id)}
                            onCheckedChange={() => toggleDept(dept.id)}
                          />
                          <span className="text-sm">{dept.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Restrict to Year Levels</Label>
                  <div className="flex gap-3 flex-wrap">
                    {YEAR_LEVELS.map(level => (
                      <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={selectedYearLevels.includes(level)}
                          onCheckedChange={() => toggleYearLevel(level)}
                        />
                        <span className="text-sm">Year {level}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {(selectedDepts.length > 0 || selectedYearLevels.length > 0) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
                    Only voters matching the selected filters will see and be able to vote in this election.
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-11 rounded-xl" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Election"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections?.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Vote}
                title="No Elections Yet"
                description="Create your first election to get started. Students will be able to vote once an election is active."
              />
            </div>
          )}
          {elections?.map(election => (
            <Card key={election.id} className="p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all border-border/50 flex flex-col group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {isScheduled(election) ? (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300">
                      <Clock className="w-3 h-3 mr-1" /> Scheduled
                    </Badge>
                  ) : (
                    <StatusBadge status={election.status} />
                  )}
                  {(election as any).electionType === "referendum" && (
                    <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Referendum</Badge>
                  )}
                  {(election as any).votingMethod === "ranked_choice" && (
                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">IRV</Badge>
                  )}
                </div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-1 rounded-md">
                  {election.votingType}
                </div>
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-2 line-clamp-2">{election.title}</h3>

              <div className="space-y-3 mt-auto pt-4 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalIcon className="w-4 h-4 text-primary/70" />
                  {isScheduled(election) ? (
                    <span>Starts {new Date(election.startDate).toLocaleDateString("en-GH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  ) : (
                    <span>{new Date(election.startDate).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary/70" />
                  <span>{election.totalCandidates} Candidates</span>
                </div>
                {(election as any).eligibleDepartments?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Restricted eligibility</span>
                  </div>
                )}
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
