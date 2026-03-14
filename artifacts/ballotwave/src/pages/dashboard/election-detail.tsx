import { useState, useRef, useEffect } from "react";
import { useParams, Link, useSearch } from "wouter";
import { useGetElection, useListCandidates, useCreateCandidate, useStartElection, useCloseElection, getGetElectionQueryKey, getListCandidatesQueryKey, useUpdateCandidate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, ArrowLeft, PlayCircle, StopCircle, BarChart2, CheckCircle2, XCircle, Flag, Users, Calendar, Vote, Camera, Phone, UserPlus, ClipboardList, ToggleLeft, ToggleRight, MessageSquare, RotateCcw, FileText, FileDown, Eye, EyeOff, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import DisputesPage from "./disputes";
import UssdSimulator from "@/components/ussd-simulator";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const createCandidateSchema = z.object({
  name: z.string().min(2),
  position: z.string().min(2),
  department: z.string().optional(),
  manifesto: z.string().optional(),
});

const nominationSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  position: z.string().min(2, "Position is required"),
  manifesto: z.string().optional(),
  videoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  department: z.string().optional(),
});

interface NominationApplication {
  id: string;
  electionId: string;
  userId: string;
  name: string;
  position: string;
  manifesto?: string;
  manifestoPdfUrl?: string;
  videoUrl?: string;
  photoUrl?: string;
  studentId?: string;
  department?: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  reviewNote?: string;
  createdAt: string;
}

export default function ElectionDetail() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab");
  const [activeTab, setActiveTab] = useState(urlTab || "candidates");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = `/dashboard/elections/${id}${tab !== "candidates" ? `?tab=${tab}` : ""}`;
    window.history.replaceState(null, "", `${import.meta.env.BASE_URL.replace(/\/$/, "")}${url}`);
  };

  const { data: election, isLoading: electionLoading } = useGetElection(id);
  const { data: candidates, isLoading: candidatesLoading } = useListCandidates(id);

  const createCandidateMutation = useCreateCandidate();
  const updateCandidateMutation = useUpdateCandidate();
  const startMutation = useStartElection();
  const closeMutation = useCloseElection();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadCandidateId = useRef<string | null>(null);

  const [nominations, setNominations] = useState<NominationApplication[]>([]);
  const [nominationsLoading, setNominationsLoading] = useState(false);
  const [nominateDialogOpen, setNominateDialogOpen] = useState(false);
  const [nominateSubmitting, setNominateSubmitting] = useState(false);
  const [nominateStep, setNominateStep] = useState(1);
  const [positionMode, setPositionMode] = useState<"select" | "custom">("select");
  const [customPosition, setCustomPosition] = useState("");
  const [nominatePhotoFile, setNominatePhotoFile] = useState<File | null>(null);
  const [nominatePdfFile, setNominatePdfFile] = useState<File | null>(null);
  const nominatePhotoRef = useRef<HTMLInputElement>(null);
  const nominatePdfRef = useRef<HTMLInputElement>(null);
  const [reviewDialogApp, setReviewDialogApp] = useState<NominationApplication | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [togglingNominations, setTogglingNominations] = useState(false);
  const [manifestoViewApp, setManifestoViewApp] = useState<NominationApplication | null>(null);

  const canManage = user?.role === "super_admin" || user?.role === "school_admin" || user?.role === "electoral_officer";

  const nominationForm = useForm<z.infer<typeof nominationSchema>>({
    resolver: zodResolver(nominationSchema),
    defaultValues: { fullName: user?.name || "", position: "", manifesto: "", videoUrl: "", department: "" },
  });

  const fetchNominations = async () => {
    setNominationsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/elections/${id}/nominations`);
      if (res.ok) {
        const data = await res.json();
        setNominations(data);
      }
    } catch {}
    setNominationsLoading(false);
  };

  useEffect(() => {
    if (id) fetchNominations();
  }, [id]);

  const handlePhotoUpload = async (file: File, candidateId: string) => {
    setUploadingPhotoFor(candidateId);
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const res = await fetch(`${BASE}/api/elections/${id}/candidates/${candidateId}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(id) });
      toast.success("Photo uploaded");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhotoFor(null);
      pendingUploadCandidateId.current = null;
    }
  };

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
    try {
      await startMutation.mutateAsync({ electionId: id });
      queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
      toast.success("Election started successfully!");
    } catch {
      toast.error("Failed to start election");
    }
  };

  const handleClose = async () => {
    try {
      await closeMutation.mutateAsync({ electionId: id });
      queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
      toast.success("Election closed");
    } catch {
      toast.error("Failed to close election");
    }
  };

  const handleApproval = async (candidateId: string, isApproved: boolean) => {
    try {
      await updateCandidateMutation.mutateAsync({ electionId: id, candidateId, data: { isApproved } as any });
      queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(id) });
      toast.success(isApproved ? "Candidate approved" : "Candidate rejected");
    } catch {
      toast.error("Failed to update candidate");
    }
  };

  const handleToggleNominations = async () => {
    setTogglingNominations(true);
    try {
      const res = await fetch(`${BASE}/api/elections/${id}/nominations-open`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: !nominationsOpen }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
      toast.success(nominationsOpen ? "Nominations closed" : "Nominations opened");
    } catch {
      toast.error("Failed to toggle nominations");
    }
    setTogglingNominations(false);
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleNominateSubmit = async (data: z.infer<typeof nominationSchema>) => {
    if (!nominatePhotoFile) {
      toast.error("A candidate photo is required");
      setNominateStep(2);
      return;
    }
    if (!nominatePdfFile) {
      toast.error("A manifesto PDF is required");
      setNominateStep(2);
      return;
    }
    setNominateSubmitting(true);
    try {
      if (nominatePhotoFile.size > 2 * 1024 * 1024) {
        toast.error("Photo must be under 2MB");
        setNominateSubmitting(false);
        return;
      }
      const photoUrl = await fileToDataUrl(nominatePhotoFile);

      if (nominatePdfFile.size > 5 * 1024 * 1024) {
        toast.error("Manifesto PDF must be under 5MB");
        setNominateSubmitting(false);
        return;
      }
      const manifestoPdfUrl = await fileToDataUrl(nominatePdfFile);

      const res = await fetch(`${BASE}/api/elections/${id}/nominate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.fullName,
          position: data.position,
          manifesto: data.manifesto,
          department: data.department,
          photoUrl,
          manifestoPdfUrl,
          videoUrl: data.videoUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to submit nomination");
      toast.success("Nomination submitted successfully! It will be reviewed by the electoral officer.");
      setNominateDialogOpen(false);
      setNominateStep(1);
      setNominatePhotoFile(null);
      setNominatePdfFile(null);
      nominationForm.reset();
      fetchNominations();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit nomination");
    }
    setNominateSubmitting(false);
  };

  const handleReview = async (applicationId: string, status: string) => {
    if ((status === "rejected" || status === "revision_requested") && !reviewNote.trim()) {
      toast.error("A reason is required when rejecting or requesting revision");
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/elections/${id}/nominations/${applicationId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed");
      }
      toast.success(
        status === "approved" ? "Nomination approved — candidate added!" :
        status === "rejected" ? "Nomination rejected" :
        "Revision requested"
      );
      setReviewDialogApp(null);
      setReviewNote("");
      fetchNominations();
      queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) });
    } catch {
      toast.error("Failed to review nomination");
    }
    setReviewSubmitting(false);
  };

  if (electionLoading || !election) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  const positions = [...new Set((candidates || []).map((c: any) => c.position))];
  const totalVoters = (election as any).registeredVoters || 0;
  const nominationsOpen = (election as any).nominationsOpen;
  const pendingCount = nominations.filter(n => n.status === "pending").length;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    revision_requested: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    revision_requested: "Revision Requested",
  };

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
            {nominationsOpen && (
              <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-[10px]">
                <UserPlus className="w-3 h-3 mr-1" /> Nominations Open
              </Badge>
            )}
            <h1 className="text-2xl font-display font-bold text-foreground">{election.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(election.startDate).toLocaleString()} &ndash; {new Date(election.endDate).toLocaleString()}
          </p>
          {(election as any).schoolName && (
            <p className="text-xs text-muted-foreground mt-0.5">{(election as any).schoolName}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/dashboard/elections/${id}/results`}>
            <Button variant="outline" className="rounded-xl border-2">
              <BarChart2 className="w-4 h-4 mr-2" /> Live Results
            </Button>
          </Link>
          {election.status === 'closed' && (
            <Button variant="outline" className="rounded-xl border-2" onClick={() => window.open(`${BASE}/api/elections/${id}/certificate`, "_blank")}>
              <FileDown className="w-4 h-4 mr-2" /> Certificate
            </Button>
          )}
          {canManage && election.status === 'draft' && (
            <Button onClick={handleStart} disabled={startMutation.isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PlayCircle className="w-4 h-4 mr-2" /> Start Election</>}
            </Button>
          )}
          {canManage && election.status === 'active' && (
            <Button onClick={handleClose} disabled={closeMutation.isPending} variant="destructive" className="rounded-xl">
              {closeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><StopCircle className="w-4 h-4 mr-2" /> End Election</>}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="rounded-lg px-5">Overview</TabsTrigger>
          <TabsTrigger value="candidates" className="rounded-lg px-5">Candidates ({(candidates || []).length})</TabsTrigger>
          {(canManage || nominationsOpen) && (
            <TabsTrigger value="nominations" className="rounded-lg px-5">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />{canManage ? "Nominations" : "Apply"}
              {canManage && pendingCount > 0 && <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingCount}</span>}
            </TabsTrigger>
          )}
          <TabsTrigger value="disputes" className="rounded-lg px-5"><Flag className="w-3.5 h-3.5 mr-1.5" />Disputes</TabsTrigger>
          {canManage && <TabsTrigger value="notifications" className="rounded-lg px-5"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Notifications</TabsTrigger>}
          {canManage && <TabsTrigger value="ussd" className="rounded-lg px-5"><Phone className="w-3.5 h-3.5 mr-1.5" />USSD</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary"><Vote className="w-6 h-6" /></div>
              <div>
                <p className="text-muted-foreground text-sm">Total Votes</p>
                <p className="font-display font-bold text-2xl">{election.totalVotes || 0}</p>
              </div>
            </Card>
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Users className="w-6 h-6" /></div>
              <div>
                <p className="text-muted-foreground text-sm">Registered Voters</p>
                <p className="font-display font-bold text-2xl">{totalVoters}</p>
              </div>
            </Card>
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500"><Users className="w-6 h-6" /></div>
              <div>
                <p className="text-muted-foreground text-sm">Candidates</p>
                <p className="font-display font-bold text-2xl">{(candidates || []).length}</p>
              </div>
            </Card>
          </div>
          {election.description && (
            <Card className="mt-4 p-5 rounded-2xl border-border/50 shadow-sm">
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-muted-foreground text-sm">{election.description}</p>
            </Card>
          )}
          <Card className="mt-4 p-5 rounded-2xl border-border/50 shadow-sm">
            <h4 className="font-semibold mb-3">Election Details</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Voting Type</dt>
              <dd className="capitalize">{election.votingType}</dd>
              <dt className="text-muted-foreground">Election Type</dt>
              <dd>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  (election as any).electionType === "referendum"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}>
                  {(election as any).electionType === "referendum" ? "Referendum" : "Standard Election"}
                </span>
              </dd>
              <dt className="text-muted-foreground">Voting Method</dt>
              <dd>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  (election as any).votingMethod === "ranked_choice"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}>
                  {(election as any).votingMethod === "ranked_choice" ? "Ranked Choice (IRV)" : "First-Past-The-Post"}
                </span>
              </dd>
              {(election as any).electionType === "referendum" && (election as any).referendumQuestion && (
                <>
                  <dt className="text-muted-foreground">Referendum Question</dt>
                  <dd className="col-span-1 italic">{(election as any).referendumQuestion}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Positions</dt>
              <dd>{positions.length || 0}</dd>
              <dt className="text-muted-foreground">Requires Payment</dt>
              <dd>{(election as any).requiresPayment ? `Yes — ${(election as any).votingFee} ${(election as any).currency}` : "No"}</dd>
              <dt className="text-muted-foreground">Results Published</dt>
              <dd>{(election as any).resultsPublished ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Nominations</dt>
              <dd>{nominationsOpen ? "Open" : "Closed"}</dd>
              <dt className="text-muted-foreground">Live Vote Count</dt>
              <dd className="flex items-center gap-1">
                {(election as any).showLiveCount !== false ? (
                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><Eye className="w-3 h-3" /> Visible to voters</span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-xs font-medium"><EyeOff className="w-3 h-3" /> Hidden during voting</span>
                )}
              </dd>
            </dl>
          </Card>
          {canManage && (
            <AdvancedSettingsCard electionId={id} election={election} onUpdated={() => queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(id) })} />
          )}
        </TabsContent>

        <TabsContent value="candidates" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-foreground">Registered Candidates</h3>
            {canManage && (
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
                    <Button type="submit" className="w-full h-11 rounded-xl" disabled={createCandidateMutation.isPending}>
                      {createCandidateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Candidate"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {candidatesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <>
              {positions.length > 0 ? positions.map(position => {
                const posCandidates = (candidates || []).filter((c: any) => c.position === position);
                return (
                  <div key={position} className="space-y-3">
                    <h4 className="font-semibold text-base text-muted-foreground border-b border-border/50 pb-2">{position}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {posCandidates.map((c: any) => (
                        <Card key={c.id} className={`p-5 rounded-2xl border-border/50 hover:border-primary/30 transition-colors ${!c.isApproved ? "opacity-70 border-red-200 bg-red-50/30" : ""}`}>
                          <div className="flex items-start gap-3">
                            <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                                  {c.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-bold text-foreground truncate">{c.name}</h4>
                                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${c.isApproved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                  {c.isApproved ? "Approved" : "Pending"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.department || "No department"}</p>
                              {c.manifesto && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.manifesto}</p>}
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
                              {!c.isApproved ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-7 text-xs rounded-lg border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleApproval(c.id, true)}
                                  disabled={updateCandidateMutation.isPending}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-7 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => handleApproval(c.id, false)}
                                  disabled={updateCandidateMutation.isPending}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs rounded-lg text-muted-foreground hover:text-foreground px-2"
                                disabled={uploadingPhotoFor === c.id}
                                onClick={() => {
                                  pendingUploadCandidateId.current = c.id;
                                  photoInputRef.current?.click();
                                }}
                              >
                                {uploadingPhotoFor === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              }) : (
                <div className="py-16 text-center bg-card rounded-2xl border border-dashed border-border">
                  <p className="text-muted-foreground">No candidates registered for this election.</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="nominations" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-foreground">Self-Nominations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {canManage
                  ? "Review and approve student nominations for candidacy."
                  : "Apply to become a candidate in this election."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canManage && (
                <Button
                  variant="outline"
                  className="rounded-xl gap-2"
                  onClick={handleToggleNominations}
                  disabled={togglingNominations}
                >
                  {togglingNominations ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : nominationsOpen ? (
                    <ToggleRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                  {nominationsOpen ? "Close Nominations" : "Open Nominations"}
                </Button>
              )}
              {!canManage && nominationsOpen && (
                <Dialog open={nominateDialogOpen} onOpenChange={(open) => { setNominateDialogOpen(open); if (!open) { setNominateStep(1); setNominatePhotoFile(null); setNominatePdfFile(null); setPositionMode("select"); setCustomPosition(""); } }}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl shadow-md shadow-primary/20">
                      <UserPlus className="w-4 h-4 mr-2" /> Nominate Yourself
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Submit Your Nomination — Step {nominateStep} of 3</DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-1 mb-2">
                      {[1,2,3].map(s => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= nominateStep ? "bg-primary" : "bg-muted"}`} />
                      ))}
                    </div>
                    <form onSubmit={nominationForm.handleSubmit(handleNominateSubmit)} className="space-y-4">
                      {nominateStep === 1 && (
                        <>
                          <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input {...nominationForm.register("fullName")} className="rounded-xl" placeholder="Your full name as it will appear on the ballot" />
                            {nominationForm.formState.errors.fullName && (
                              <p className="text-xs text-destructive">{nominationForm.formState.errors.fullName.message}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Position You're Running For *</Label>
                            {(() => {
                              const existingPositions = [...new Set((candidates || []).map(c => c.position))];
                              const nominationPositions = [...new Set(nominations.map(n => n.position))];
                              const allPositions = [...new Set([...existingPositions, ...nominationPositions])].sort();
                              if (allPositions.length > 0 && positionMode === "select") {
                                return (
                                  <>
                                    <select
                                      value={nominationForm.watch("position")}
                                      onChange={(e) => {
                                        if (e.target.value === "__custom__") {
                                          setPositionMode("custom");
                                          setCustomPosition("");
                                          nominationForm.setValue("position", "");
                                        } else {
                                          nominationForm.setValue("position", e.target.value);
                                        }
                                      }}
                                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                    >
                                      <option value="">Select a position...</option>
                                      {allPositions.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                      ))}
                                      <option value="__custom__">Other (type your own)</option>
                                    </select>
                                  </>
                                );
                              }
                              return (
                                <div className="flex gap-2">
                                  <Input
                                    value={positionMode === "custom" ? customPosition : nominationForm.watch("position")}
                                    onChange={(e) => {
                                      setCustomPosition(e.target.value);
                                      nominationForm.setValue("position", e.target.value);
                                    }}
                                    className="rounded-xl flex-1"
                                    placeholder="e.g. President, Secretary"
                                  />
                                  {allPositions.length > 0 && (
                                    <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => { setPositionMode("select"); nominationForm.setValue("position", ""); }}>
                                      Back to list
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                            {nominationForm.formState.errors.position && (
                              <p className="text-xs text-destructive">{nominationForm.formState.errors.position.message}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Department (Optional)</Label>
                            <Input {...nominationForm.register("department")} className="rounded-xl" placeholder="Your department" />
                          </div>
                          <div className="space-y-2">
                            <Label>Your Manifesto</Label>
                            <Textarea
                              {...nominationForm.register("manifesto")}
                              className="rounded-xl resize-none"
                              rows={4}
                              placeholder="Share your vision and plans..."
                            />
                          </div>
                          <Button type="button" className="w-full h-11 rounded-xl" onClick={async () => {
                            const valid = await nominationForm.trigger(["fullName", "position"]);
                            if (valid) setNominateStep(2);
                          }}>
                            Next: Upload Files
                          </Button>
                        </>
                      )}
                      {nominateStep === 2 && (
                        <>
                          <div className="space-y-2">
                            <Label>Candidate Photo * (Max 2MB)</Label>
                            <input type="file" accept="image/*" ref={nominatePhotoRef} className="hidden" onChange={(e) => setNominatePhotoFile(e.target.files?.[0] || null)} />
                            <Button type="button" variant="outline" className="w-full rounded-xl justify-start" onClick={() => nominatePhotoRef.current?.click()}>
                              <Camera className="w-4 h-4 mr-2" />
                              {nominatePhotoFile ? nominatePhotoFile.name : "Choose photo..."}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label>Manifesto PDF * (Max 5MB)</Label>
                            <input type="file" accept=".pdf" ref={nominatePdfRef} className="hidden" onChange={(e) => setNominatePdfFile(e.target.files?.[0] || null)} />
                            <Button type="button" variant="outline" className="w-full rounded-xl justify-start" onClick={() => nominatePdfRef.current?.click()}>
                              <FileText className="w-4 h-4 mr-2" />
                              {nominatePdfFile ? nominatePdfFile.name : "Choose PDF..."}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label>Campaign Video URL (Optional — YouTube or Vimeo)</Label>
                            <Input {...nominationForm.register("videoUrl")} className="rounded-xl" placeholder="https://youtube.com/watch?v=..." />
                            {nominationForm.formState.errors.videoUrl && (
                              <p className="text-xs text-destructive">{nominationForm.formState.errors.videoUrl.message}</p>
                            )}
                          </div>
                          <div className="flex gap-3">
                            <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setNominateStep(1)}>Back</Button>
                            <Button type="button" className="flex-1 h-11 rounded-xl" onClick={() => setNominateStep(3)}>Next: Review</Button>
                          </div>
                        </>
                      )}
                      {nominateStep === 3 && (
                        <>
                          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                            <p><span className="font-semibold">Full Name:</span> {nominationForm.getValues("fullName")}</p>
                            <p><span className="font-semibold">Position:</span> {nominationForm.getValues("position")}</p>
                            {nominationForm.getValues("department") && <p><span className="font-semibold">Department:</span> {nominationForm.getValues("department")}</p>}
                            {nominationForm.getValues("manifesto") && <p><span className="font-semibold">Manifesto:</span> {nominationForm.getValues("manifesto")?.slice(0, 120)}...</p>}
                            {nominatePhotoFile && <p><span className="font-semibold">Photo:</span> {nominatePhotoFile.name}</p>}
                            {nominatePdfFile && <p><span className="font-semibold">PDF:</span> {nominatePdfFile.name}</p>}
                            {nominationForm.getValues("videoUrl") && <p><span className="font-semibold">Video:</span> {nominationForm.getValues("videoUrl")}</p>}
                          </div>
                          <div className="flex gap-3">
                            <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setNominateStep(2)}>Back</Button>
                            <Button type="submit" className="flex-1 h-11 rounded-xl" disabled={nominateSubmitting}>
                              {nominateSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Nomination"}
                            </Button>
                          </div>
                        </>
                      )}
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              {!canManage && !nominationsOpen && (
                <Badge variant="secondary" className="rounded-xl text-xs py-1.5 px-3">
                  Nominations are currently closed
                </Badge>
              )}
            </div>
          </div>

          {!canManage && nominationsOpen && (
            <div className="py-8 text-center bg-card rounded-2xl border border-dashed border-border">
              <UserPlus className="w-10 h-10 mx-auto mb-3 text-primary/40" />
              <p className="text-muted-foreground font-medium">Ready to run for office?</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Nominate Yourself" above to submit your candidacy application.</p>
            </div>
          )}

          {canManage && (nominationsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : nominations.length === 0 ? (
            <div className="py-16 text-center bg-card rounded-2xl border border-dashed border-border">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">No nominations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {nominationsOpen
                  ? "Waiting for students to submit nominations."
                  : "Nominations are currently closed."}
              </p>
            </div>
          ) : (() => {
            const pending = nominations.filter(a => a.status === "pending");
            const revisionRequested = nominations.filter(a => a.status === "revision_requested");
            const approved = nominations.filter(a => a.status === "approved");
            const rejected = nominations.filter(a => a.status === "rejected");

            const renderNomCard = (app: NominationApplication) => (
              <Card key={app.id} className="p-5 rounded-2xl border-border/50 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
                    {app.photoUrl ? (
                      <img src={app.photoUrl} alt={app.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {app.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-foreground">{app.name}</h4>
                        <p className="text-xs text-muted-foreground">for <span className="font-medium text-foreground">{app.position}</span></p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusColors[app.status]}`}>
                        {statusLabels[app.status]}
                      </span>
                    </div>
                    {app.department && <p className="text-xs text-muted-foreground mt-1">{app.department}</p>}
                    {(app.manifesto || app.manifestoPdfUrl) && (
                      <button
                        className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                        onClick={() => setManifestoViewApp(app)}
                      >
                        <FileText className="w-3 h-3" /> View Manifesto
                      </button>
                    )}
                    {app.reviewNote && (
                      <div className="mt-2 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{app.reviewNote}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Applied {new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {canManage && app.status === "pending" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
                    <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleReview(app.id, "approved")} disabled={reviewSubmitting}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50" onClick={() => { setReviewDialogApp(app); setReviewNote(""); }}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg px-2" onClick={() => { setReviewDialogApp(app); setReviewNote(""); }} title="Request revision">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </Card>
            );

            return (
              <div className="space-y-6">
                {pending.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                      <Flag className="w-4 h-4" /> Pending Review ({pending.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{pending.map(renderNomCard)}</div>
                  </div>
                )}
                {revisionRequested.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" /> Revision Requested ({revisionRequested.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{revisionRequested.map(renderNomCard)}</div>
                  </div>
                )}
                {approved.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2 list-none">
                      <CheckCircle2 className="w-4 h-4" /> Approved ({approved.length})
                      <span className="text-[10px] text-muted-foreground ml-auto group-open:hidden">Click to expand</span>
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">{approved.map(renderNomCard)}</div>
                  </details>
                )}
                {rejected.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2 list-none">
                      <XCircle className="w-4 h-4" /> Rejected ({rejected.length})
                      <span className="text-[10px] text-muted-foreground ml-auto group-open:hidden">Click to expand</span>
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">{rejected.map(renderNomCard)}</div>
                  </details>
                )}
              </div>
            );
          })())}
        </TabsContent>

        {canManage && (
          <TabsContent value="notifications">
            <ElectionNotificationLog electionId={id} />
          </TabsContent>
        )}

        <TabsContent value="disputes">
          <DisputesPage electionId={id} showReporter={canManage} />
        </TabsContent>

        {canManage && (
          <TabsContent value="ussd">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
                  <h4 className="font-semibold mb-3">USSD Voting Info</h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Voting Type</dt>
                    <dd className="capitalize">{election.votingType}</dd>
                    <dt className="text-muted-foreground">USSD Enabled</dt>
                    <dd>{election.votingType === "ussd" || election.votingType === "both" ? "Yes" : "No"}</dd>
                  </dl>
                  <p className="text-xs text-muted-foreground mt-4">
                    Use the simulator to test the USSD flow for this election. Enter your registered phone number and PIN to authenticate, then navigate the menus.
                  </p>
                </Card>
              </div>
              <UssdSimulator electionId={id} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!reviewDialogApp} onOpenChange={() => setReviewDialogApp(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Review Nomination: {reviewDialogApp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-muted/50 rounded-xl text-sm">
              <p><span className="font-medium">Position:</span> {reviewDialogApp?.position}</p>
              <p><span className="font-medium">Department:</span> {reviewDialogApp?.department || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <Label>Review Note (required for reject/revision)</Label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="rounded-xl resize-none"
                rows={3}
                placeholder="Reason for rejection or revision..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                onClick={() => reviewDialogApp && handleReview(reviewDialogApp.id, "rejected")}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-2" /> Reject</>}
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => reviewDialogApp && handleReview(reviewDialogApp.id, "revision_requested")}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 mr-2" /> Request Revision</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manifestoViewApp} onOpenChange={() => setManifestoViewApp(null)}>
        <DialogContent className="sm:max-w-3xl w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> {manifestoViewApp?.name}'s Manifesto
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-3">Position: <span className="font-medium text-foreground">{manifestoViewApp?.position}</span></p>
            {manifestoViewApp?.manifestoPdfUrl && (manifestoViewApp.manifestoPdfUrl.startsWith("data:application/pdf") || manifestoViewApp.manifestoPdfUrl.startsWith("https://")) && (
              <iframe
                src={manifestoViewApp.manifestoPdfUrl}
                className="w-full h-[60vh] rounded-xl border border-border mb-3"
                title="Manifesto PDF"
                sandbox="allow-same-origin"
              />
            )}
            {manifestoViewApp?.manifesto && (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {manifestoViewApp.manifesto}
              </div>
            )}
            {manifestoViewApp?.videoUrl && (
              <div className="mt-3">
                <a href={manifestoViewApp.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                  🎬 Watch Campaign Video
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && pendingUploadCandidateId.current) {
            handlePhotoUpload(file, pendingUploadCandidateId.current);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

function AdvancedSettingsCard({ electionId, election, onUpdated }: { electionId: string; election: any; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);
  const showLiveCount = election.showLiveCount !== false;

  const toggleLiveCount = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/elections/${electionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showLiveCount: !showLiveCount }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(showLiveCount ? "Live count hidden from voters" : "Live count visible to voters");
      onUpdated();
    } catch {
      toast.error("Failed to update settings");
    }
    setSaving(false);
  };

  return (
    <Card className="mt-4 p-5 rounded-2xl border-border/50 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-semibold">Advanced Settings</h4>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <div>
            <p className="text-sm font-medium text-foreground">Live Vote Count Visibility</p>
            <p className="text-xs text-muted-foreground">When enabled, voters can see live vote counts during the election</p>
          </div>
          <button
            onClick={toggleLiveCount}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showLiveCount ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${showLiveCount ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Election Type</p>
            <p className="text-xs text-muted-foreground capitalize">
              {election.electionType === "referendum" ? "Referendum — Yes/No vote" : "Standard — Candidate-based election"}
            </p>
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {election.electionType || "standard"}
          </Badge>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Voting Method</p>
            <p className="text-xs text-muted-foreground">
              {election.votingMethod === "ranked_choice" ? "Ranked Choice (IRV) — voters rank candidates" : "First-Past-The-Post — one vote per position"}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {election.votingMethod === "ranked_choice" ? "IRV" : "FPTP"}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

function ElectionNotificationLog({ electionId }: { electionId: string }) {
  const [logs, setLogs] = useState<Array<{
    id: string; channel: string; event: string; message: string; status: string;
    recipientPhone?: string; recipientEmail?: string; sentAt: string; error?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/notifications/log?electionId=${electionId}&limit=200`)
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [electionId]);

  const statusColor = (s: string) =>
    s === "sent" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
    s === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
    "bg-gray-100 text-gray-700";

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center bg-card rounded-2xl border border-dashed border-border">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">No notifications sent for this election yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-foreground">Notification Timeline</h3>
      <p className="text-sm text-muted-foreground">All notifications sent for this election across SMS, email, and in-app channels.</p>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 text-sm">
            <div className="mt-0.5">
              {log.channel === "sms" ? <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> :
               log.channel === "email" ? <FileText className="w-3.5 h-3.5 text-violet-500" /> :
               <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColor(log.status)}`}>{log.status}</span>
                <Badge variant="secondary" className="text-[10px] rounded-full">{log.event.replace(/_/g, " ")}</Badge>
                <Badge variant="outline" className="text-[10px] rounded-full uppercase">{log.channel}</Badge>
              </div>
              <p className="text-xs text-foreground mt-1 line-clamp-2">{log.message.replace(/<[^>]+>/g, "").substring(0, 150)}</p>
              {log.error && <p className="text-[10px] text-red-500 mt-0.5">{log.error}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">
                {log.recipientPhone || log.recipientEmail || "—"} &middot; {new Date(log.sentAt).toLocaleString("en-GB")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
