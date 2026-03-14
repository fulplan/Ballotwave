import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, Building2, Phone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const COLORS = ["hsl(160, 84%, 39%)", "hsl(222, 47%, 45%)", "hsl(43, 74%, 56%)", "hsl(280, 60%, 55%)"];

interface RevenueData {
  mrr: number;
  arr: number;
  totalRevenue: number;
  monthlyRevenue: { month: string; revenue: number }[];
  revenueByPlan: { plan: string; revenue: number }[];
  topSchools: { schoolId: string; name: string; plan: string; revenue: number }[];
  ussd: { totalUssdSessions: number; totalUssdVotes: number; estimatedGatewayCost: number; ussdRevenueCollected: number; netUssdRevenue: number; ussdPassthrough: boolean; currency: string };
}

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/analytics/revenue`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const planColors: Record<string, string> = { free: "bg-gray-100 text-gray-700", basic: "bg-blue-100 text-blue-700", pro: "bg-violet-100 text-violet-700", enterprise: "bg-amber-100 text-amber-700" };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Revenue Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform-wide revenue tracking and monetization metrics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500"><DollarSign className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                <p className="font-bold text-xl">GHS {data.mrr.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">ARR</p>
                <p className="font-bold text-xl">GHS {data.arr.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500"><Building2 className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="font-bold text-xl">GHS {data.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500"><Phone className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">USSD Gateway Cost</p>
                <p className="font-bold text-xl">GHS {data.ussd.estimatedGatewayCost.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 rounded-2xl border-border/50 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-bold mb-4">Monthly Revenue (Last 12 Months)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={v => `₵${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    formatter={(value: number) => [`GHS ${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Revenue by Plan</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.revenueByPlan.filter(p => p.revenue > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={5} dataKey="revenue" nameKey="plan">
                    {data.revenueByPlan.filter(p => p.revenue > 0).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} formatter={(value: number) => [`GHS ${value.toLocaleString()}`, "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {data.revenueByPlan.filter(p => p.revenue > 0).map((entry, i) => (
                <div key={entry.plan} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="capitalize text-muted-foreground">{entry.plan}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Top Schools by Revenue</CardTitle>
              <CardDescription>Highest revenue-generating schools on the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topSchools.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No revenue data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.topSchools.map((school, i) => (
                    <div key={school.schoolId} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{school.name}</p>
                          <Badge variant="secondary" className={`text-[10px] rounded-full capitalize ${planColors[school.plan] || ""}`}>{school.plan}</Badge>
                        </div>
                      </div>
                      <span className="font-bold text-sm">GHS {school.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">USSD Cost Tracker</CardTitle>
              <CardDescription>Monitor USSD gateway costs and session volumes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                  <p className="font-bold text-2xl mt-1">{data.ussd.totalUssdSessions.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">USSD Votes</p>
                  <p className="font-bold text-2xl mt-1">{data.ussd.totalUssdVotes.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">Gateway Cost</p>
                  <p className="font-bold text-2xl mt-1 text-red-600">GHS {data.ussd.estimatedGatewayCost.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">Collected from Schools</p>
                  <p className="font-bold text-2xl mt-1 text-blue-600">GHS {data.ussd.ussdRevenueCollected.toLocaleString()}</p>
                </div>
                <div className={`p-4 rounded-xl text-center col-span-2 ${data.ussd.netUssdRevenue >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                  <p className="text-xs text-muted-foreground">Net USSD Revenue {!data.ussd.ussdPassthrough && "(Passthrough OFF)"}</p>
                  <p className={`font-bold text-2xl mt-1 ${data.ussd.netUssdRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>GHS {data.ussd.netUssdRevenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
