import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, User, Shield, Clock, CheckCircle2, KeyRound, Vote, Moon, Sun, UserPlus, XCircle, RotateCcw, ClipboardList, Edit, Camera, FileText, Link2, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTheme } from "next-themes";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const profileSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(6, "At least 6 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

interface VoteHistory {
  electionId: string;
  electionTitle: string;
  receiptCode: string;
  votedAt: string;
}

interface MyNomination {
  id: string;
  electionId: string;
  electionTitle: string;
  position: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  reviewNote?: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  electoral_officer: "Electoral Officer",
  observer: "Observer",
  candidate: "Candidate",
  voter: "Voter",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  school_admin: "bg-blue-100 text-blue-700",
  electoral_officer: "bg-amber-100 text-amber-700",
  observer: "bg-gray-100 text-gray-700",
  candidate: "bg-emerald-100 text-emerald-700",
  voter: "bg-green-100 text-green-700",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [history, setHistory] = useState<VoteHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [myNominations, setMyNominations] = useState<MyNomination[]>([]);
  const [nominationsLoading, setNominationsLoading] = useState(true);
  const [resubmitNom, setResubmitNom] = useState<MyNomination | null>(null);
  const [resubmitManifesto, setResubmitManifesto] = useState("");
  const [resubmitSubmitting, setResubmitSubmitting] = useState(false);
  const [resubmitPhotoFile, setResubmitPhotoFile] = useState<File | null>(null);
  const [resubmitPdfFile, setResubmitPdfFile] = useState<File | null>(null);
  const [resubmitVideoUrl, setResubmitVideoUrl] = useState("");
  const resubmitPhotoRef = useRef<HTMLInputElement>(null);
  const resubmitPdfRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || "", phone: user?.phone || "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user?.role === "voter") {
      fetch(`${BASE}/api/users/${user.id}/vote-history`)
        .then(r => r.json())
        .then(data => setHistory(data.history || []))
        .catch(() => {})
        .finally(() => setHistoryLoading(false));

      fetch(`${BASE}/api/elections/my-nominations/all`)
        .then(r => r.json())
        .then(data => setMyNominations(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setNominationsLoading(false));
    } else {
      setHistoryLoading(false);
      setNominationsLoading(false);
    }
  }, [user]);

  const fetchNominations = () => {
    fetch(`${BASE}/api/elections/my-nominations/all`)
      .then(r => r.json())
      .then(data => setMyNominations(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleResubmit = async () => {
    if (!resubmitNom) return;
    setResubmitSubmitting(true);
    try {
      const payload: Record<string, string | undefined> = { manifesto: resubmitManifesto };
      if (resubmitPhotoFile) {
        if (resubmitPhotoFile.size > 2 * 1024 * 1024) {
          toast.error("Photo must be under 2MB");
          setResubmitSubmitting(false);
          return;
        }
        payload.photoUrl = await fileToDataUrl(resubmitPhotoFile);
      }
      if (resubmitPdfFile) {
        if (resubmitPdfFile.size > 5 * 1024 * 1024) {
          toast.error("PDF must be under 5MB");
          setResubmitSubmitting(false);
          return;
        }
        payload.manifestoPdfUrl = await fileToDataUrl(resubmitPdfFile);
      }
      if (resubmitVideoUrl) {
        payload.videoUrl = resubmitVideoUrl;
      }

      const res = await fetch(`${BASE}/api/elections/${resubmitNom.electionId}/nominations/${resubmitNom.id}/resubmit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to resubmit");
      }
      toast.success("Nomination resubmitted for review!");
      setResubmitNom(null);
      setResubmitPhotoFile(null);
      setResubmitPdfFile(null);
      setResubmitVideoUrl("");
      fetchNominations();
    } catch (err: any) {
      toast.error(err.message || "Failed to resubmit");
    }
    setResubmitSubmitting(false);
  };

  const onProfileSave = async (data: z.infer<typeof profileSchema>) => {
    setSavingProfile(true);
    try {
      const res = await fetch(`${BASE}/api/users/${user!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const onPasswordChange = async (data: z.infer<typeof passwordSchema>) => {
    try {
      const res = await fetch(`${BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to change password");
      toast.success("Password changed successfully");
      passwordForm.reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account information and security settings.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="rounded-2xl border-border/50 shadow-sm lg:col-span-1 h-fit">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
              <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
              <div className="mt-3 flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user.role] || "bg-muted text-muted-foreground"}`}>
                  <Shield className="w-3 h-3" />
                  {roleLabels[user.role] || user.role}
                </span>
              </div>
              {user.studentId && (
                <p className="text-xs text-muted-foreground mt-3 font-mono">{user.studentId}</p>
              )}
              <div className="mt-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4 shrink-0" />
                  <span>{user.isVerified ? "Verified" : "Not Verified"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Joined {new Date(user.createdAt!).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Appearance</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 text-xs"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>Update your name and contact details.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={profileForm.handleSubmit(onProfileSave)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Full Name</Label>
                      <Input {...profileForm.register("name")} className="rounded-xl" />
                      {profileForm.formState.errors.name && (
                        <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Phone Number</Label>
                      <Input {...profileForm.register("phone")} className="rounded-xl" placeholder="+233 XX XXX XXXX" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Email Address</Label>
                    <Input value={user.email} disabled className="rounded-xl bg-muted/50" />
                    <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
                  </div>
                  <Button type="submit" disabled={savingProfile} className="rounded-xl">
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <KeyRound className="w-5 h-5" /> Change Password
                </CardTitle>
                <CardDescription>Keep your account secure with a strong password.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(onPasswordChange)} className="space-y-4">
                  <div className="space-y-1">
                    <Label>Current Password</Label>
                    <Input type="password" {...passwordForm.register("currentPassword")} className="rounded-xl" placeholder="Your current password" />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>New Password</Label>
                      <Input type="password" {...passwordForm.register("newPassword")} className="rounded-xl" placeholder="Min. 6 characters" />
                      {passwordForm.formState.errors.newPassword && (
                        <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Confirm New Password</Label>
                      <Input type="password" {...passwordForm.register("confirmPassword")} className="rounded-xl" placeholder="Repeat new password" />
                      {passwordForm.formState.errors.confirmPassword && (
                        <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </div>
                  <Button type="submit" disabled={passwordForm.formState.isSubmitting} variant="outline" className="rounded-xl">
                    {passwordForm.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Update Password
                  </Button>
                </form>
              </CardContent>
            </Card>

            {user.role === "voter" && (
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Vote className="w-5 h-5" /> Voting History
                  </CardTitle>
                  <CardDescription>Elections you have participated in.</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Vote className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>You haven't voted in any elections yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div>
                              <p className="font-medium text-sm text-foreground">{item.electionTitle}</p>
                              <p className="text-xs text-muted-foreground font-mono">{item.receiptCode}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(item.votedAt).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {user.role === "voter" && (
              <NotificationPreferences userId={user.id} />
            )}

            {user.role === "voter" && (
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5" /> My Nominations
                  </CardTitle>
                  <CardDescription>Track the status of your candidacy applications.</CardDescription>
                </CardHeader>
                <CardContent>
                  {nominationsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : myNominations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>You haven't submitted any nominations yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myNominations.map((nom) => {
                        const statusIcon = nom.status === "approved" ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> :
                          nom.status === "rejected" ? <XCircle className="w-5 h-5 text-red-500 shrink-0" /> :
                          nom.status === "revision_requested" ? <RotateCcw className="w-5 h-5 text-blue-500 shrink-0" /> :
                          <Clock className="w-5 h-5 text-amber-500 shrink-0" />;
                        const statusLabel = nom.status === "approved" ? "Approved" :
                          nom.status === "rejected" ? "Rejected" :
                          nom.status === "revision_requested" ? "Revision Needed" : "Pending";
                        const statusColor = nom.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          nom.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                          nom.status === "revision_requested" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
                        return (
                          <div key={nom.id} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                {statusIcon}
                                <div>
                                  <p className="font-medium text-sm text-foreground">{nom.position}</p>
                                  <p className="text-xs text-muted-foreground">{nom.electionTitle}</p>
                                </div>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            {nom.reviewNote && (
                              <p className="text-xs text-muted-foreground mt-2 ml-8 p-2 bg-muted/50 rounded-lg">{nom.reviewNote}</p>
                            )}
                            <div className="flex items-center justify-between mt-2 ml-8">
                              <p className="text-[10px] text-muted-foreground">
                                Applied {new Date(nom.createdAt).toLocaleDateString("en-GB")}
                              </p>
                              {nom.status === "revision_requested" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs rounded-lg border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                                  onClick={() => { setResubmitNom(nom); setResubmitManifesto(""); }}
                                >
                                  <Edit className="w-3 h-3 mr-1" /> Edit & Resubmit
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!resubmitNom} onOpenChange={() => setResubmitNom(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit & Resubmit Nomination</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-muted/50 rounded-xl text-sm">
              <p><span className="font-medium">Election:</span> {resubmitNom?.electionTitle}</p>
              <p><span className="font-medium">Position:</span> {resubmitNom?.position}</p>
            </div>
            {resubmitNom?.reviewNote && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-sm border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Reviewer Feedback:</p>
                <p className="text-blue-800 dark:text-blue-300">{resubmitNom.reviewNote}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Updated Manifesto</Label>
              <Textarea
                value={resubmitManifesto}
                onChange={(e) => setResubmitManifesto(e.target.value)}
                className="rounded-xl resize-none"
                rows={4}
                placeholder="Update your manifesto based on the feedback..."
              />
            </div>
            <div className="space-y-2">
              <Label>Replace Photo (Max 2MB)</Label>
              <input type="file" accept="image/*" ref={resubmitPhotoRef} className="hidden" onChange={(e) => setResubmitPhotoFile(e.target.files?.[0] || null)} />
              <Button type="button" variant="outline" size="sm" className="w-full rounded-xl justify-start text-xs" onClick={() => resubmitPhotoRef.current?.click()}>
                <Camera className="w-3 h-3 mr-1.5" />
                {resubmitPhotoFile ? resubmitPhotoFile.name : "Choose new photo (optional)..."}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Replace Manifesto PDF (Max 5MB)</Label>
              <input type="file" accept=".pdf" ref={resubmitPdfRef} className="hidden" onChange={(e) => setResubmitPdfFile(e.target.files?.[0] || null)} />
              <Button type="button" variant="outline" size="sm" className="w-full rounded-xl justify-start text-xs" onClick={() => resubmitPdfRef.current?.click()}>
                <FileText className="w-3 h-3 mr-1.5" />
                {resubmitPdfFile ? resubmitPdfFile.name : "Choose new PDF (optional)..."}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Campaign Video URL (Optional)</Label>
              <Input
                value={resubmitVideoUrl}
                onChange={(e) => setResubmitVideoUrl(e.target.value)}
                className="rounded-xl text-sm"
                placeholder="https://youtube.com/..."
              />
            </div>
            <Button
              className="w-full h-11 rounded-xl"
              onClick={handleResubmit}
              disabled={resubmitSubmitting}
            >
              {resubmitSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Resubmit Nomination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function NotificationPreferences({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState({
    notifyElectionReminders: true,
    notifyResultAnnouncements: true,
    notifyPlatformAnnouncements: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/users/${userId}/notification-preferences`)
      .then(r => r.json())
      .then(data => {
        setPrefs({
          notifyElectionReminders: data.notifyElectionReminders ?? true,
          notifyResultAnnouncements: data.notifyResultAnnouncements ?? true,
          notifyPlatformAnnouncements: data.notifyPlatformAnnouncements ?? true,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const togglePref = async (key: keyof typeof prefs) => {
    const newVal = !prefs[key];
    setPrefs(p => ({ ...p, [key]: newVal }));
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/users/${userId}/notification-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newVal }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Preferences updated");
    } catch {
      setPrefs(p => ({ ...p, [key]: !newVal }));
      toast.error("Failed to update preferences");
    }
    setSaving(false);
  };

  const prefItems = [
    { key: "notifyElectionReminders" as const, label: "Election Reminders", desc: "SMS/in-app reminders before voting deadlines" },
    { key: "notifyResultAnnouncements" as const, label: "Result Announcements", desc: "Get notified when election results are published" },
    { key: "notifyPlatformAnnouncements" as const, label: "Platform Announcements", desc: "General announcements from your school admin" },
  ];

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" /> Notification Preferences
        </CardTitle>
        <CardDescription>Choose which notifications you'd like to receive.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {prefItems.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button
                  onClick={() => togglePref(item.key)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs[item.key] ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${prefs[item.key] ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
