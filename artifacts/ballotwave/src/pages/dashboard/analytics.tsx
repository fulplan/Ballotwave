import { useGetAnalyticsOverview } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, TrendingUp, Building2, Vote } from "lucide-react";

const COLORS = ['hsl(160, 84%, 39%)', 'hsl(222, 47%, 15%)', 'hsl(43, 74%, 66%)', 'hsl(0, 84%, 60%)'];

export default function AnalyticsPage() {
  const { data, isLoading } = useGetAnalyticsOverview();

  if (isLoading || !data) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Platform Analytics</h1>
          <p className="text-muted-foreground mt-1">High-level overview of system usage and revenue.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 rounded-2xl border-border/50 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><Building2 className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Schools</p>
              <p className="text-2xl font-bold">{data.totalSchools}</p>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-border/50 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Vote className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Active Elections</p>
              <p className="text-2xl font-bold">{data.activeElections}</p>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-border/50 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><TrendingUp className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Votes Cast</p>
              <p className="text-2xl font-bold">{data.totalVotes}</p>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-border/50 shadow-sm flex items-center gap-4 bg-primary text-primary-foreground">
            <div>
              <p className="text-sm text-primary-foreground/80 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold">GHS {data.totalRevenue.toLocaleString()}</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <Card className="p-6 rounded-2xl border-border/50 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-bold mb-6">Votes Cast Over Time (Last 7 Days)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.votesByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Elections by Status</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.electionsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                  >
                    {data.electionsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                {data.electionsByStatus.map((entry, index) => (
                  <div key={entry.status} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="capitalize text-muted-foreground">{entry.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
