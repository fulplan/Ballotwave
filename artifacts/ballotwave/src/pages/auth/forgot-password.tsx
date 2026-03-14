import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Vote, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Request failed");
      setSent(true);
      if (json._devToken) setDevToken(json._devToken);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Vote className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-display font-bold">BallotWave</span>
          </div>
        </div>

        <Card className="p-8 rounded-3xl border-border/50 shadow-xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold">Check your inbox</h2>
              <p className="text-muted-foreground text-sm">
                If that email address is registered, we've sent password reset instructions.
              </p>
              {devToken && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Dev Mode — Reset Token</p>
                  <p className="font-mono text-xs text-amber-900 break-all">{devToken}</p>
                  <Link href={`/reset-password?token=${devToken}`}>
                    <Button size="sm" className="mt-3 w-full rounded-xl" variant="outline">Use this token to reset</Button>
                  </Link>
                </div>
              )}
              <Link href="/login">
                <Button variant="ghost" className="mt-2 w-full rounded-xl">Back to Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Forgot your password?</h2>
                <p className="text-muted-foreground mt-1 text-sm">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="you@school.edu.gh" {...register("email")} className="h-12 rounded-xl bg-background" />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Instructions"}
                </Button>
              </form>

              <Link href="/login">
                <Button variant="ghost" className="w-full mt-3 rounded-xl gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Button>
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
