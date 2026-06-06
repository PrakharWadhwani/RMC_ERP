"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useAuthStore } from "../../store/useAuthStore";
import Link from "next/link";
import api from "../../lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuthStore();
  const router = useRouter();

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotStep, setForgotStep] = useState(1); // 1: request, 2: verify
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    try {
      const res = await api.post("/auth/forgot-password/request", { phone_no: forgotPhone });
      setForgotSuccess(res.data.message);
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(err.response?.data?.detail || err.message || "Failed to request OTP");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    try {
      const res = await api.post("/auth/forgot-password/verify", {
        phone_no: forgotPhone,
        code: forgotOtp,
        new_password: forgotNewPassword,
        confirm_password: forgotConfirmPassword,
      });
      setForgotSuccess("Password reset successfully! You can now log in.");
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotPhone("");
        setForgotOtp("");
        setForgotNewPassword("");
        setForgotConfirmPassword("");
        setForgotSuccess("");
      }, 3000);
    } catch (err: any) {
      setForgotError(err.response?.data?.detail || err.message || "Failed to reset password");
    } finally {
      setForgotLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      window.location.href = "/";
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
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStep(1);
                    setForgotError("");
                    setForgotSuccess("");
                  }}
                  className="text-xs font-bold text-white/40 hover:text-[var(--primary-green)] transition-colors"
                >
                  Forgot Password?
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-white mb-2">Reset Password</h3>
            <p className="text-sm text-white/50 mb-6">
              {forgotStep === 1
                ? "Enter your registered phone number to receive an OTP."
                : "Enter the OTP sent to your phone and your new password."}
            </p>

            {forgotError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-bold text-red-400">{forgotError}</p>
              </div>
            )}
            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-bold text-green-400">{forgotSuccess}</p>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-phone" className="text-xs font-black uppercase text-white/60">
                    Phone Number
                  </Label>
                  <Input
                    id="forgot-phone"
                    type="text"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    required
                    placeholder="Enter phone number"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 border-white/10 text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={forgotLoading || !forgotPhone}
                    className="flex-1"
                    style={{ background: "var(--primary-green)", color: "white" }}
                  >
                    {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-otp" className="text-xs font-black uppercase text-white/60">
                    OTP Code
                  </Label>
                  <Input
                    id="forgot-otp"
                    type="text"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    required
                    placeholder="Enter 6-digit OTP"
                    className="bg-white/5 border-white/10 text-white tracking-widest text-center"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forgot-new-pwd" className="text-xs font-black uppercase text-white/60">
                    New Password
                  </Label>
                  <Input
                    id="forgot-new-pwd"
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    required
                    placeholder="New password"
                    className="bg-white/5 border-white/10 text-white"
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forgot-confirm-pwd" className="text-xs font-black uppercase text-white/60">
                    Confirm Password
                  </Label>
                  <Input
                    id="forgot-confirm-pwd"
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm new password"
                    className="bg-white/5 border-white/10 text-white"
                    minLength={6}
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotStep(1);
                    }}
                    className="flex-1 border-white/10 text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={forgotLoading || !forgotOtp || !forgotNewPassword || !forgotConfirmPassword}
                    className="flex-1"
                    style={{ background: "var(--primary-green)", color: "white" }}
                  >
                    {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Reset"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}