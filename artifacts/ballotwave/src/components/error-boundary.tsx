import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-background text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground max-w-md">
              {this.state.error?.message || "An unexpected error occurred. Please refresh and try again."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => this.setState({ hasError: false, error: null })} variant="outline" className="rounded-xl">
              Try Again
            </Button>
            <Button onClick={() => window.location.href = "/"} className="rounded-xl">
              Go Home
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
