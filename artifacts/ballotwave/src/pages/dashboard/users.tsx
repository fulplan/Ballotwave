import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Users, Upload, Search, UserCheck, UserX, Shield } from "lucide-react";
import { SkeletonTable } from "@/components/skeleton-cards";
import { EmptyState } from "@/components/empty-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchUsers(schoolId: string, role?: string) {
  const params = new URLSearchParams({ schoolId });
  if (role) params.set("role", role);
  const res = await fetch(`${BASE}/api/users?${params}`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function updateUser(id: string, data: any) {
  const res = await fetch(`${BASE}/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}

async function bulkImport(schoolId: string, users: any[]) {
  const res = await fetch(`${BASE}/api/users/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId, users }),
  });
  if (!res.ok) throw new Error("Failed to import users");
  return res.json();
}

const addUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["school_admin", "electoral_officer", "voter", "observer"]),
  studentId: z.string().optional(),
});

const roleBadge: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  school_admin: "bg-blue-100 text-blue-700",
  electoral_officer: "bg-amber-100 text-amber-700",
  candidate: "bg-emerald-100 text-emerald-700",
  voter: "bg-gray-100 text-gray-700",
  observer: "bg-cyan-100 text-cyan-700",
};

export default function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", user?.schoolId],
    queryFn: () => fetchUsers(user!.schoolId!),
    enabled: !!user?.schoolId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: () => toast.error("Failed to update user"),
  });

  const addForm = useForm<z.infer<typeof addUserSchema>>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { name: "", email: "", role: "voter" },
  });

  const onAddSubmit = async (data: z.infer<typeof addUserSchema>) => {
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, password: "changeme123", schoolId: user!.schoolId }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Failed to create user");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsAddOpen(false);
      addForm.reset();
      toast.success("User created. Default password: changeme123");
    } catch {
      toast.error("Failed to create user");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      }).filter(r => r.name && r.email);
      const result = await bulkImport(user!.schoolId!, rows);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(result.message);
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = (users || []).filter((u: any) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.studentId || "").includes(search)
  );

  const voters = filtered.filter((u: any) => u.role === "voter");
  const staff = filtered.filter((u: any) => ["school_admin", "electoral_officer", "observer"].includes(u.role));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage voters, officers, and observers for your institution.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl h-11 px-4">
                <Upload className="w-4 h-4 mr-2" /> Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Import Students</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Upload a CSV with columns: <code className="bg-muted px-1 rounded text-xs">name, email, studentId, departmentId, yearLevel, phone</code>. Default password: <strong>changeme123</strong></p>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                  <Upload className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Select your CSV file</p>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" id="csv-input" onChange={handleFileImport} />
                  <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()} disabled={importLoading}>
                    {importLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Choose File
                  </Button>
                </div>
                {importResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                    <p className="font-medium text-emerald-800">{importResult.message}</p>
                    {importResult.errors?.length > 0 && (
                      <ul className="mt-2 text-red-600 space-y-1">
                        {importResult.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl h-11 px-5 shadow-md shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add User</DialogTitle>
              </DialogHeader>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input {...addForm.register("name")} className="rounded-xl" placeholder="e.g. Kwame Mensah" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input {...addForm.register("email")} type="email" className="rounded-xl" placeholder="student@school.edu.gh" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select onValueChange={(v) => addForm.setValue("role", v as any)} defaultValue="voter">
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voter">Voter (Student)</SelectItem>
                      <SelectItem value="electoral_officer">Electoral Officer</SelectItem>
                      <SelectItem value="observer">Observer / Auditor</SelectItem>
                      <SelectItem value="school_admin">School Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Student ID (optional)</Label>
                  <Input {...addForm.register("studentId")} className="rounded-xl" placeholder="e.g. STU-2024-001" />
                </div>
                <Button type="submit" className="w-full rounded-xl h-11">Create User</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-xl h-10"
          placeholder="Search by name, email or student ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <SkeletonTable rows={6} />
        </div>
      ) : (
        <Tabs defaultValue="voters">
          <TabsList className="rounded-xl">
            <TabsTrigger value="voters" className="rounded-lg">
              <Users className="w-4 h-4 mr-1.5" /> Voters ({voters.length})
            </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-lg">
              <Shield className="w-4 h-4 mr-1.5" /> Staff & Officers ({staff.length})
            </TabsTrigger>
          </TabsList>

          {[{ key: "voters", data: voters }, { key: "staff", data: staff }].map(({ key, data }) => (
            <TabsContent key={key} value={key} className="mt-4">
              {data.length === 0 ? (
                <div className="py-16 text-center bg-card rounded-2xl border border-dashed border-border">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No users found.</p>
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((u: any) => (
                        <TableRow key={u.id} className="border-border/30">
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.studentId || "—"}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadge[u.role] || "bg-gray-100 text-gray-700"}`}>
                              {u.role.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-lg text-xs"
                              onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                            >
                              {u.isActive ? <UserX className="w-3.5 h-3.5 mr-1" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                              {u.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
