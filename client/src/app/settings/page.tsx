"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import api from "../../lib/api";
import type { User } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

type Feedback = {
  type: "success" | "error";
  text: string;
} | null;

export default function SettingsPage() {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSession, setOtpSession] = useState("");

  const [contactForm, setContactForm] = useState({
    email: "",
    phone_no: "",
    new_password: "",
    confirm_password: "",
  });

  const [systemSettings, setSystemSettings] = useState({
    low_stock_limit: 5,
  });

  const [initialLowStockLimit, setInitialLowStockLimit] = useState(5);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const response = await api.get("/auth/me");
      const nextProfile = response.data as User;
      setProfile(nextProfile);
      setContactForm({
        email: nextProfile.email || "",
        phone_no: nextProfile.phone_no || "",
        new_password: "",
        confirm_password: "",
      });

      if (nextProfile.is_admin) {
        const settingsResponse = await api.get("/finances/system-settings");
        const nextLimit = settingsResponse.data.low_stock_limit ?? 5;
        setSystemSettings({ low_stock_limit: nextLimit });
        setInitialLowStockLimit(nextLimit);
      }
    } catch (error: any) {
      setFeedback({
        type: "error",
        text: error.response?.data?.detail || "Unable to load your account details.",
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleRequestOtp = async () => {
    setFeedback(null);

    const targetPhone = contactForm.phone_no.trim();
    if (!targetPhone) {
      setFeedback({
        type: "error",
        text: "Enter a phone number first so we can send the verification code.",
      });
      return;
    }

    setOtpLoading(true);
    try {
      await api.post("/auth/otp/request", { phone_no: targetPhone });
      setOtpRequested(true);
      setOtpVerified(false);
      setOtpSession("");
      setOtpCode("");
      setFeedback({
        type: "success",
        text: `OTP sent to ${targetPhone}. Enter it below to unlock changes.`,
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        text: error.response?.data?.detail || "Unable to send OTP right now.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setFeedback(null);

    if (!otpCode.trim()) {
      setFeedback({
        type: "error",
        text: "Enter the OTP before continuing.",
      });
      return;
    }

    setOtpLoading(true);
    try {
      const response = await api.post("/auth/otp/verify", { code: otpCode.trim() });
      setOtpSession(response.data.verification_token);
      setOtpVerified(true);
      setFeedback({
        type: "success",
        text: "OTP verified. Your details are ready to be saved.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        text: error.response?.data?.detail || "OTP verification failed.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const lowStockChanged = Boolean(profile?.is_admin && systemSettings.low_stock_limit !== initialLowStockLimit);

  const handleSaveChanges = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!otpVerified || !otpSession) {
      setFeedback({
        type: "error",
        text: "Verify the OTP first before saving changes.",
      });
      return;
    }

    const email = contactForm.email.trim();
    const phone_no = contactForm.phone_no.trim();
    const newPassword = contactForm.new_password;
    const confirmPassword = contactForm.confirm_password;

    const hasEmailChange = email && email !== (profile?.email || "");
    const hasPhoneChange = phone_no && phone_no !== (profile?.phone_no || "");
    const hasPasswordChange = newPassword.length > 0 || confirmPassword.length > 0;

    if (!hasEmailChange && !hasPhoneChange && !hasPasswordChange && !lowStockChanged) {
      setFeedback({
        type: "error",
        text: "Make a change before saving.",
      });
      return;
    }

    if (hasPasswordChange) {
      if (!newPassword || !confirmPassword) {
        setFeedback({
          type: "error",
          text: "Both password fields are required when changing your password.",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        setFeedback({
          type: "error",
          text: "New passwords do not match.",
        });
        return;
      }
    }

    if (profile?.is_admin && systemSettings.low_stock_limit < 0) {
      setFeedback({
        type: "error",
        text: "Low stock limit cannot be negative.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.put("/auth/settings", {
        email: hasEmailChange ? email : undefined,
        phone_no: hasPhoneChange ? phone_no : undefined,
        new_password: hasPasswordChange ? newPassword : undefined,
        confirm_password: hasPasswordChange ? confirmPassword : undefined,
        otp_session: otpSession,
      });

      setProfile(response.data);
      setContactForm({
        email: response.data.email || "",
        phone_no: response.data.phone_no || "",
        new_password: "",
        confirm_password: "",
      });

      if (profile?.is_admin && lowStockChanged) {
        const settingsResponse = await api.put("/finances/system-settings", {
          low_stock_limit: systemSettings.low_stock_limit,
          otp_session: otpSession,
        });
        setSystemSettings({ low_stock_limit: settingsResponse.data.low_stock_limit ?? systemSettings.low_stock_limit });
        setInitialLowStockLimit(settingsResponse.data.low_stock_limit ?? systemSettings.low_stock_limit);
      }

      setOtpRequested(false);
      setOtpVerified(false);
      setOtpSession("");
      setOtpCode("");
      setFeedback({
        type: "success",
        text: profile?.is_admin && lowStockChanged
          ? "Account settings and low-stock threshold updated successfully."
          : "Account settings updated successfully.",
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        text: error.response?.data?.detail || "Unable to update settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">Security & Account</p>
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your account details and, for admins, the low-stock threshold used by the dashboard notifications.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Account overview
            </CardTitle>
            <CardDescription>
              Your current profile details are shown below. Passwords are not exposed here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingProfile ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading account details...
              </div>
            ) : profile ? (
              <>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Username</p>
                  <p className="mt-2 text-lg font-black">{profile.username}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Email</p>
                    <p className="mt-2 font-bold">{profile.email}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
                    <p className="mt-2 font-bold">{profile.phone_no || "Not set"}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Role</p>
                    <p className="mt-2 font-bold">{profile.is_admin ? "Admin" : "Staff"}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                    <p className="mt-2 font-bold">{profile.is_active ? "Active" : "Inactive"}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load your profile right now.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Update account details
            </CardTitle>
            <CardDescription>
              Edit your email, phone number, or password. A one-time OTP will be required before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSaveChanges}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactForm.email}
                    onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_no">Phone number</Label>
                  <Input
                    id="phone_no"
                    type="tel"
                    value={contactForm.phone_no}
                    onChange={(event) => setContactForm((current) => ({ ...current, phone_no: event.target.value }))}
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">Password</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword ? "text" : "password"}
                    value={contactForm.new_password}
                    onChange={(event) => setContactForm((current) => ({ ...current, new_password: event.target.value }))}
                    placeholder="Leave blank to keep current password"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Leave this field empty unless you want to change the password.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <Input
                  id="confirm_password"
                  type={showPassword ? "text" : "password"}
                  value={contactForm.confirm_password}
                  onChange={(event) => setContactForm((current) => ({ ...current, confirm_password: event.target.value }))}
                  placeholder="Repeat new password"
                />
              </div>

              <div className="rounded-xl border border-dashed bg-muted/20 p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">OTP verification</p>
                    <p className="text-sm text-muted-foreground">
                      {otpRequested
                        ? "An OTP has been requested for your phone number. Verify it before saving."
                        : "Request a one-time password for the phone number above."}
                    </p>
                  </div>
                  <Button type="button" onClick={handleRequestOtp} disabled={otpLoading} className="md:w-auto">
                    {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Request OTP
                  </Button>
                </div>

                {otpRequested && (
                  <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="otp_code">Enter OTP</Label>
                      <Input
                        id="otp_code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={() => handleVerifyOtp()} disabled={otpLoading} className="w-full md:w-auto">
                        {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Verify OTP
                      </Button>
                    </div>
                  </div>
                )}

                {otpVerified && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    OTP verified successfully. You can now save your changes.
                  </div>
                )}
              </div>

              {profile?.is_admin && (
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Low stock threshold</p>
                      <p className="text-sm text-muted-foreground">
                        This value controls the dashboard alert count and the notification panel.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 max-w-xs space-y-2">
                    <Label htmlFor="low_stock_limit">Minimum quantity before low-stock alert</Label>
                    <Input
                      id="low_stock_limit"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={systemSettings.low_stock_limit}
                      onChange={(event) =>
                        setSystemSettings((current) => ({
                          ...current,
                          low_stock_limit: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {feedback && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${feedback.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-red-500/30 bg-red-500/10 text-red-600"}`}>
                  {feedback.type === "success" ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertCircle className="mr-2 inline h-4 w-4" />}
                  {feedback.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !otpVerified} className="w-full md:w-auto">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
