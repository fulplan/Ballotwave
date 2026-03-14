import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ShieldCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  schoolId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  "election.create": "bg-blue-100 text-blue-700",
  "election.start": "bg-emerald-100 text-emerald-700",
  "election.close": "bg-red-100 text-red-700",
  "election.publish_results": "bg-purple-100 text-purple-700",
  "candidate.add": "bg-sky-100 text-sky-700",
  "candidate.approve": "bg-green-100 text-green-700",
  "candidate.reject": "bg-orange-100 text-orange-700",
  "candidate.remove": "bg-red-100 text-red-700",
  "user.deactivate": "bg-red-100 text-red-700",
};

const ACTION_LABELS: Record<string, string> = {
  "election.create": "Election Created",
  "election.start": "Election Started",
  "election.close": "Election Closed",
  "election.publish_results": "Results Published",
  "candidate.add": "Candidate Added",
  "candidate.approve": "Candidate Approved",
  "candidate.reject": "Candidate Rejected",
  "candidate.remove": "Candidate Removed",
  "user.deactivate": "User Deactivated",
};

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const loadLogs = async (pageNum = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
      });
      if (entityFilter && entityFilter !== "all") params.set("entityType", entityFilter);

      const res = await fetch(`${BASE}/api/audit?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setLogs(json.logs || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(page);
  }, [entityFilter, page]);

  const filtered = logs.filter(l =>
    !search ||
    l.action.includes(search.toLowerCase()) ||
    l.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
    l.entityLabel?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary" /> Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">A complete record of all administrative actions on the platform.</p>
          </div>
          <Button onClick={() => loadLogs(0)} variant="outline" className="rounded-xl gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action, user or entity..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-full sm:w-44 rounded-xl">
                  <SelectValue placeholder="Filter by entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  <SelectItem value="election">Elections</SelectItem>
                  <SelectItem value="candidate">Candidates</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">No audit events found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {log.entityLabel && (
                          <span className="text-sm font-medium text-foreground truncate">
                            {log.entityLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        {log.userEmail && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
                            {log.userEmail}
                          </span>
                        )}
                        {log.ipAddress && <span>{log.ipAddress}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 text-right">
                      <div>{new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <div>{new Date(log.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{total} total events</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-xl">Previous</Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-xl">Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
