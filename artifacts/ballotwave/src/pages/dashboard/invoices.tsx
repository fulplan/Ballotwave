import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Send, CheckCircle2, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LineItem {
  description: string;
  amount: number;
}

interface Invoice {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolPlan: string;
  periodStart: string;
  periodEnd: string;
  lineItems: LineItem[];
  totalGhs: number;
  status: string;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      const url = statusFilter === "all" ? `${BASE}/api/invoices` : `${BASE}/api/invoices?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) setInvoices(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [statusFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${BASE}/api/invoices/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      toast.success(`Generated ${json.count} invoice(s)`);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoices");
    }
    setGenerating(false);
  };

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      const res = await fetch(`${BASE}/api/invoices/${id}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Invoice sent");
      fetchInvoices();
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
    } catch {
      toast.error("Failed to send invoice");
    }
    setSending(null);
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/api/invoices/${id}/download`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download invoice");
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/api/invoices/${id}/mark-paid`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Invoice marked as paid");
      fetchInvoices();
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
    } catch {
      toast.error("Failed to mark invoice as paid");
    }
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-emerald-100 text-emerald-700";
    if (s === "sent") return "bg-blue-100 text-blue-700";
    if (s === "overdue") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const totalOutstanding = invoices.filter(i => i.status === "sent" || i.status === "draft").reduce((s, i) => s + i.totalGhs, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.totalGhs, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-1">Manage school invoices and billing.</p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="rounded-xl h-11">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Generate Monthly Invoices
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><FileText className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Invoices</p>
                <p className="font-bold text-xl">{invoices.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500"><FileText className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-bold text-xl">GHS {totalOutstanding.toFixed(2)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500"><CheckCircle2 className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="font-bold text-xl">GHS {totalPaid.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Invoice History</CardTitle>
              <CardDescription>All school invoices across the platform.</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No invoices found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="py-3 px-3 font-semibold text-muted-foreground">School</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Period</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Amount</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Status</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Created</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                        <td className="py-3 px-3">
                          <p className="font-medium">{inv.schoolName || "Unknown"}</p>
                          <span className="text-[10px] text-muted-foreground capitalize">{inv.schoolPlan}</span>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}
                        </td>
                        <td className="py-3 px-3 font-bold">GHS {inv.totalGhs.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className={`text-[10px] rounded-full capitalize ${statusColor(inv.status)}`}>{inv.status}</Badge>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">{formatDate(inv.createdAt)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {inv.status === "draft" && (
                              <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => handleSend(inv.id)} disabled={sending === inv.id}>
                                {sending === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />} Send
                              </Button>
                            )}
                            {(inv.status === "sent" || inv.status === "overdue") && (
                              <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => handleMarkPaid(inv.id)}>
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => handleDownload(inv.id)}>
                              <Download className="w-3 h-3 mr-1" /> Download
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4 mt-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{selectedInvoice.schoolName}</p>
                    <p className="text-sm text-muted-foreground capitalize">{selectedInvoice.schoolPlan} Plan</p>
                  </div>
                  <Badge variant="secondary" className={`capitalize ${statusColor(selectedInvoice.status)}`}>{selectedInvoice.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Period: {formatDate(selectedInvoice.periodStart)} — {formatDate(selectedInvoice.periodEnd)}</p>
                  {selectedInvoice.sentAt && <p>Sent: {formatDate(selectedInvoice.sentAt)}</p>}
                  {selectedInvoice.paidAt && <p>Paid: {formatDate(selectedInvoice.paidAt)}</p>}
                </div>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr><th className="py-2 px-3 text-left font-semibold">Item</th><th className="py-2 px-3 text-right font-semibold">Amount</th></tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.lineItems as LineItem[]).map((item, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="py-2 px-3">{item.description}</td>
                          <td className="py-2 px-3 text-right">GHS {item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border font-bold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right">GHS {selectedInvoice.totalGhs.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  {selectedInvoice.status === "draft" && (
                    <Button className="flex-1 rounded-xl" onClick={() => handleSend(selectedInvoice.id)} disabled={sending === selectedInvoice.id}>
                      {sending === selectedInvoice.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Send to School
                    </Button>
                  )}
                  {(selectedInvoice.status === "sent" || selectedInvoice.status === "overdue") && (
                    <Button className="flex-1 rounded-xl" onClick={() => handleMarkPaid(selectedInvoice.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Paid
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-xl" onClick={() => handleDownload(selectedInvoice.id)}>
                    <Download className="w-4 h-4 mr-2" /> Download
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
