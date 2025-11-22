import React, { useState } from "react";
import { useAuthStore } from "../client/store";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight, Loader2, GraduationCap } from "lucide-react";
import { Card, Button, Input } from "../components/ui";

interface LoginProps {
  onNavigateToSignup: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToSignup }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await window.auth.login({ email, password });
      if (result.success && result.user) {
        login(result.user);
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary/20 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="bubbly-card p-8 border-border/50 bg-card/80 backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center text-primary-foreground mb-6 shadow-xl shadow-primary/30 transform rotate-3">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Welcome Back</h1>
            <p className="text-muted-foreground mt-2">Sign in to continue learning</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/50 border border-transparent focus:bg-background focus:border-primary rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-foreground placeholder:text-muted-foreground/50"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-transparent focus:bg-background focus:border-primary rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-foreground placeholder:text-muted-foreground/50"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-lg rounded-2xl shadow-lg shadow-primary/25"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <button
              onClick={onNavigateToSignup}
              className="text-primary hover:text-primary/80 font-bold hover:underline transition-all"
            >
              Sign up
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
