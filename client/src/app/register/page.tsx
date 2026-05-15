"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useAuthStore } from "../../store/useAuthStore"; // Use the store!
import Link from "next/link";

export default function RegisterPage() {
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const { register, isLoading } = useAuthStore(); // Get register from store
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Use the store function we created
    const result = await register(formData.username, formData.email, formData.password);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      setTimeout(() => router.push("/login"), 3000);
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, oklch(0.15 0.02 250) 0%, oklch(0.10 0.01 200) 50%, oklch(0.13 0.03 280) 100%)" }}
    >
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "var(--primary-green)" }} />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-2xl border border-white/10 p-8 backdrop-blur-xl" style={{ background: "oklch(0.18 0.01 250 / 80%)" }}>
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Staff Access</h2>
            <p className="text-sm text-white/50 mt-1">Submit request for admin approval</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-white/60">Username</Label>
              <Input 
                className="bg-white/5 border-white/10 text-white"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-white/60">Email</Label>
              <Input 
                type="email"
                className="bg-white/5 border-white/10 text-white"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-white/60">Password</Label>
              <Input 
                type="password"
                className="bg-white/5 border-white/10 text-white"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                required 
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <p className="text-sm font-bold">{message.text}</p>
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full h-12 font-black" style={{ background: "var(--primary-green)", color: "white" }}>
              {isLoading ? <Loader2 className="animate-spin" /> : "REQUEST APPROVAL"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-xs text-white/40 hover:text-white transition-colors">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}