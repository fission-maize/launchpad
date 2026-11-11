import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowRight, X } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: new URL("/auth/callback", window.location.origin).href,
          },
        });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101114] text-[#f2f3f5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141b7b]">
            <Mail size={28} className="text-white" />
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.6px]">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-[13px] text-[#a0a3aa]">
            {mode === "signin"
              ? "Sign in to your Rain dashboard"
              : "Sign up to start your Rain dashboard"}
          </p>
        </div>

        <div className="rounded-[22px] border border-[#303238] bg-[#1c1e22] p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#c3c5cb] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a0a3aa]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-11 w-full rounded-xl border border-[#383a40] bg-[#151619] pl-10 pr-3.5 text-[13px] text-[#f2f3f5] outline-none transition focus:border-[#141b7b] focus:ring-2 focus:ring-[#141b7b]/20 placeholder:text-[#858991]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#c3c5cb] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a0a3aa]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 w-full rounded-xl border border-[#383a40] bg-[#151619] pl-10 pr-3.5 text-[13px] text-[#f2f3f5] outline-none transition focus:border-[#141b7b] focus:ring-2 focus:ring-[#141b7b]/20 placeholder:text-[#858991]"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-[#2a1d22] border border-[#5b2a35] px-3 py-2 text-[12px] text-[#e8a4b0]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#141b7b] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#252d93] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Sign up"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="text-[12px] text-[#a0a3aa] hover:text-[#c3c8ff] transition"
            >
              {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#6b6e75]">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}