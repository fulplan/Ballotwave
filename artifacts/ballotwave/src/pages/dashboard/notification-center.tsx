import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageSquare, Mail, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NotificationLogEntry {
  id: string;
  channel: string;
  event: string;
  message: string;
  subject?: string;
  status: string;
  recipientPhone?: string;
  recipientEmail?: string;
  sentAt: string;
  error?: string;
}

interface ChannelStat {
  channel: string;
  status: string;
  count: number;
}

interface EventStat {
  event: string;
  count: number;
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const canBroadcast = user?.role === "school_admin";
  const [channel, setChannel] = useState<"sms" | "email" | "both">("sms");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [channelStats, setChannelStats] = useState<ChannelStat[]>([]);
  const [eventStats, setEventStats] = useState<EventStat[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${BASE}/api/notifications/log?limit=50`);
      if (res.ok) setLogs(await res.json());
    } catch {}
    setLogsLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${BASE}/api/notifications/log/stats`);
      if (res.ok) {
        const data = await res.json();
        setChannelStats(data.channelStats || []);
        setEventStats(data.eventStats || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    if (channel !== "sms" && !subject.trim()) {
      toast.error("Subject is required for email broadcasts");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/notifications/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: message.trim(), subject: subject.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send");
      toast.success(json.message || "Broadcast sent!");
      setMessage("");
      setSubject("");
      fetchLogs();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to send broadcast");
    }
    setSending(false);
  };

  const smsCount = channelStats.filter(s => s.channel === "sms" && s.status === "sent").reduce((a, b) => a + b.count, 0);
  const emailCount = channelStats.filter(s => s.channel === "email" && s.status === "sent").reduce((a, b) => a + b.count, 0);
  const failedCount = channelStats.filter(s => s.status === "failed").reduce((a, b) => a + b.count, 0);
  const totalCount = channelStats.reduce((a, b) => a + b.count, 0);

  const channelIcon = (ch: string) => {
    if (ch === "sms") return <MessageSquare className="w-3.5 h-3.5" />;
    if (ch === "email") return <Mail className="w-3.5 h-3.5" />;
    return <CheckCircle2 className="w-3.5 h-3.5" />;
  };

  const statusColor = (status: string) => {
    if (status === "sent") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    return "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Notification Center</h1>
          <p className="text-muted-foreground mt-1">Send broadcasts and view notification delivery history.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Send className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sent</p>
                <p className="font-bold text-xl">{totalCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500"><MessageSquare className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">SMS Sent</p>
                <p className="font-bold text-xl">{smsCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500"><Mail className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Emails Sent</p>
                <p className="font-bold text-xl">{emailCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 rounded-xl text-red-500"><AlertTriangle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="font-bold text-xl">{failedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className={`grid grid-cols-1 ${canBroadcast ? "lg:grid-cols-3" : ""} gap-6`}>
          {canBroadcast && (
            <Card className="rounded-2xl border-border/50 shadow-sm lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Compose Broadcast</CardTitle>
                <CardDescription>Send a message to all voters in your school.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <div className="flex gap-2">
                    {(["sms", "email", "both"] as const).map(ch => (
                      <Button
                        key={ch}
                        variant={channel === ch ? "default" : "outline"}
                        size="sm"
                        className="rounded-xl flex-1 capitalize"
                        onClick={() => setChannel(ch)}
                      >
                        {ch === "sms" && <MessageSquare className="w-3.5 h-3.5 mr-1" />}
                        {ch === "email" && <Mail className="w-3.5 h-3.5 mr-1" />}
                        {ch === "both" && <Send className="w-3.5 h-3.5 mr-1" />}
                        {ch}
                      </Button>
                    ))}
                  </div>
                </div>
                {(channel === "email" || channel === "both") && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="rounded-xl"
                      placeholder="Email subject..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="rounded-xl resize-none"
                    rows={5}
                    placeholder="Type your broadcast message..."
                    maxLength={640}
                  />
                  <p className="text-xs text-muted-foreground text-right">{message.length}/640</p>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="w-full h-11 rounded-xl"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Broadcast
                </Button>
                <p className="text-[10px] text-muted-foreground">Rate limit: 2 broadcasts per hour</p>
              </CardContent>
            </Card>
          )}

          <Card className={`rounded-2xl border-border/50 shadow-sm ${canBroadcast ? "lg:col-span-2" : ""}`}>
            <CardHeader>
              <CardTitle className="text-lg">Send History</CardTitle>
              <CardDescription>Recent notifications sent from your school.</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No notifications sent yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 text-sm">
                      <div className="mt-0.5">{channelIcon(log.channel)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColor(log.status)}`}>
                            {log.status}
                          </span>
                          <Badge variant="secondary" className="text-[10px] rounded-full">{log.event}</Badge>
                          <Badge variant="outline" className="text-[10px] rounded-full uppercase">{log.channel}</Badge>
                        </div>
                        <p className="text-xs text-foreground mt-1 line-clamp-2">{log.message.replace(/<[^>]+>/g, "").substring(0, 120)}</p>
                        {log.error && <p className="text-[10px] text-red-500 mt-0.5">{log.error}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {log.recipientPhone || log.recipientEmail || "—"} &middot; {new Date(log.sentAt).toLocaleString("en-GB")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {eventStats.length > 0 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Notification Events Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {eventStats.map(ev => (
                  <div key={ev.event} className="p-3 bg-muted/30 rounded-xl text-center">
                    <p className="text-xs text-muted-foreground capitalize">{ev.event.replace(/_/g, " ")}</p>
                    <p className="font-bold text-lg mt-1">{ev.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
