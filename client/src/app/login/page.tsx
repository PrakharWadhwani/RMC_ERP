"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useAuthStore } from "../../store/useAuthStore";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuthStore();
  const router = useRouter();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, oklch(0.15 0.02 250) 0%, oklch(0.10 0.01 200) 50%, oklch(0.13 0.03 280) 100%)",
      }}
    >
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary-green)" }}
      />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl" style={{ background: "var(--primary-green)" }}>
              <Zap size={28} className="text-white" fill="currentColor" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">RAINBOW</h1>
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/40">
            Enterprise Resource Planning
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 p-8 backdrop-blur-xl"
          style={{ background: "oklch(0.18 0.01 250 / 80%)" }}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white">Sign In</h2>
            <p className="text-sm text-white/50 mt-1">Enter your credentials to access the system</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-xs font-black uppercase tracking-wider text-white/60">
                Phone Number
              </Label>
              <Input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter phone number or existing username"
                className="h-12 bg-white/5 border-white/10 text-white focus:border-[var(--primary-green)]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-xs font-black uppercase tracking-wider text-white/60">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-white/5 border-white/10 text-white pr-12 focus:border-[var(--primary-green)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-bold text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full h-14 text-lg font-black rounded-xl"
              style={{ background: "var(--primary-green)", color: "white" }}
            >
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "ACCESS SYSTEM"}
            </Button>
          </form>

          {/* New Register Link */}
          <div className="mt-6 text-center">
            <Link 
              href="/register" 
              className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-[var(--primary-green)] transition-colors"
            >
              <UserPlus size={14} />
              NEW STAFF? REQUEST ACCESS
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-[11px] text-white/30 font-mono">
              Rainbow ERP v2.0 • Secured Access Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}