import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Send, RotateCcw, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message {
  type: "system" | "user";
  text: string;
}

interface UssdSimulatorProps {
  electionId?: string;
}

export default function UssdSimulator({ electionId }: UssdSimulatorProps) {
  const [sessionId] = useState(() => `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function startSession() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/ussd/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, phoneNumber: "" }),
      });
      const data = await res.json();
      setMessages([{ type: "system", text: data.message }]);
      setSessionActive(data.sessionOperation === "continue");
      setCurrentStep(data.step || "");
    } catch {
      setMessages([{ type: "system", text: "Failed to start USSD session" }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendInput() {
    if (!input.trim() || loading) return;
    const userInput = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { type: "user", text: userInput }]);
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api/ussd/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, input: userInput }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { type: "system", text: data.message }]);
      setSessionActive(data.sessionOperation === "continue");
      setCurrentStep(data.step || "");
    } catch {
      setMessages((prev) => [...prev, { type: "system", text: "Connection error" }]);
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    setMessages([]);
    setSessionActive(false);
    setCurrentStep("");
    setInput("");
  }

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Phone className="w-4 h-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base">USSD Simulator</CardTitle>
            {sessionActive && (
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                {currentStep}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetSession} title="Reset">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div
          ref={scrollRef}
          className="h-[280px] overflow-y-auto rounded-lg border bg-gray-950 p-3 font-mono text-sm space-y-2"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
              <Phone className="w-8 h-8 mb-2 opacity-50" />
              <p>Click "Start Session" to begin</p>
              <p className="mt-1 text-gray-600">Simulates the USSD voting experience</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={msg.type === "system" ? "text-green-400" : "text-yellow-300"}>
                {msg.type === "system" ? (
                  <pre className="whitespace-pre-wrap leading-relaxed">{msg.text}</pre>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">&gt;</span>
                    <span>{msg.text}</span>
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="text-gray-500 animate-pulse">Processing...</div>
          )}
        </div>

        {!sessionActive && messages.length === 0 ? (
          <Button className="w-full" onClick={startSession} disabled={loading}>
            <Phone className="w-4 h-4 mr-2" />
            Start USSD Session
          </Button>
        ) : sessionActive ? (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendInput()}
              placeholder="Type response (e.g. 1, 0, #)..."
              className="font-mono"
              disabled={loading}
              autoFocus
            />
            <Button size="icon" onClick={sendInput} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button className="w-full" variant="outline" onClick={resetSession}>
            <RotateCcw className="w-4 h-4 mr-2" />
            New Session
          </Button>
        )}

        <div className="flex flex-wrap gap-1">
          {["1", "2", "3", "0", "#", "00"].map((key) => (
            <Button
              key={key}
              size="sm"
              variant="outline"
              className="h-7 w-10 text-xs font-mono"
              disabled={!sessionActive || loading}
              onClick={() => {
                setInput(key);
                setTimeout(() => {
                  const fakeInput = key;
                  setInput("");
                  setMessages((prev) => [...prev, { type: "user", text: fakeInput }]);
                  setLoading(true);
                  fetch(`${BASE}/api/ussd/simulate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, input: fakeInput }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      setMessages((prev) => [...prev, { type: "system", text: data.message }]);
                      setSessionActive(data.sessionOperation === "continue");
                      setCurrentStep(data.step || "");
                    })
                    .catch(() => {
                      setMessages((prev) => [...prev, { type: "system", text: "Connection error" }]);
                    })
                    .finally(() => setLoading(false));
                }, 50);
              }}
            >
              {key}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground self-center ml-1">Quick keys</span>
        </div>
      </CardContent>
    </Card>
  );
}
