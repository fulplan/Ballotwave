import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vote, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "school_admin", "voter"]),
});

export default function AuthPage({ isRegister = false }: { isRegister?: boolean }) {
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", role: "voter" }
  });

  const onLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      await login(data);
      toast({ title: "Welcome back!", description: "Successfully logged in." });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    }
  };

  const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    try {
      await register({ ...data, role: data.role as any });
      toast({ title: "Account created", description: "Welcome to BallotWave!" });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message || "Something went wrong", variant: "destructive" });
    }
  };

  const isPending = isLoggingIn || isRegistering;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Background elements */}
      <div className="absolute inset-0 z-0 hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10"></div>
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Auth Background" 
          className="absolute right-0 top-0 w-1/2 h-full object-cover opacity-30 mix-blend-overlay"
        />
      </div>

      <Card className="w-full max-w-md p-8 relative z-10 shadow-2xl shadow-primary/10 border-border/50 rounded-3xl bg-card/80 backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 mb-4 cursor-pointer" onClick={() => setLocation('/')}>
            <Vote className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">{isRegister ? "Create Account" : "Welcome Back"}</h1>
          <p className="text-muted-foreground mt-2">{isRegister ? "Start running secure elections today" : "Enter your credentials to continue"}</p>
        </div>

        {!isRegister ? (
          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...loginForm.register("email")} className="h-12 rounded-xl bg-background" />
              {loginForm.formState.errors.email && <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="text-xs text-primary font-medium cursor-pointer hover:underline">Forgot password?</span>
              </div>
              <Input id="password" type="password" placeholder="••••••••" {...loginForm.register("password")} className="h-12 rounded-xl bg-background" />
              {loginForm.formState.errors.password && <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-semibold" disabled={isPending}>
              {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Don't have an account? <span className="text-primary font-semibold cursor-pointer hover:underline" onClick={() => setLocation('/register')}>Register</span>
            </p>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="John Doe" {...registerForm.register("name")} className="h-12 rounded-xl bg-background" />
              {registerForm.formState.errors.name && <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...registerForm.register("email")} className="h-12 rounded-xl bg-background" />
              {registerForm.formState.errors.email && <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Account Type</Label>
              <Select onValueChange={(val) => registerForm.setValue("role", val as any)} defaultValue="voter">
                <SelectTrigger className="h-12 rounded-xl bg-background">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voter">Student / Voter</SelectItem>
                  <SelectItem value="school_admin">School Administrator</SelectItem>
                  <SelectItem value="super_admin">Platform Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...registerForm.register("password")} className="h-12 rounded-xl bg-background" />
              {registerForm.formState.errors.password && <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-semibold" disabled={isPending}>
              {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account? <span className="text-primary font-semibold cursor-pointer hover:underline" onClick={() => setLocation('/login')}>Sign in</span>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
