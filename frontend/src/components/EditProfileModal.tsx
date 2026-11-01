import React, { useState, useEffect } from "react";
import { 
  X, 
  User, 
  Mail, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send, 
  Save, 
  RefreshCw
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: (user: any) => void;
}

export function EditProfileModal({ isOpen, onClose, onUserUpdated }: EditProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "email" | "security">("general");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [officialDomain, setOfficialDomain] = useState("mit.asia");

  // General info form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [classYear, setClassYear] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Email change form
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);

  // Password change form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const [userData, domainData] = await Promise.all([
        apiFetch("/users/me").catch(() => null),
        apiFetch("/system/domain").catch(() => ({ official_domain: "mit.asia" }))
      ]);

      if (userData) {
        setUser(userData);
        setFullName(userData.full_name || "");
        setPhone(userData.phone || "");
        setClassYear(userData.class_year || "");
        if (userData.pending_email) {
          setPendingEmail(userData.pending_email);
        }
      }
      if (domainData?.official_domain) {
        setOfficialDomain(domainData.official_domain);
      }
    } catch (err) {
      console.error("Failed to load user profile in modal", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUserData();
      setEmailOtp("");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Save General Profile Info
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }

    setSavingGeneral(true);
    try {
      const res = await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          class_year: classYear.trim() || undefined
        })
      });

      toast.success(res.message || "Profile details updated successfully!");
      if (res.user) {
        setUser(res.user);
        if (onUserUpdated) onUserUpdated(res.user);
      } else {
        fetchUserData();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingGeneral(false);
    }
  };

  // Step 1: Request Email Change
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanEmail) {
      toast.error("Please enter a new email address.");
      return;
    }

    if (cleanEmail === user?.email?.toLowerCase()) {
      toast.error("New email cannot be the same as your current email.");
      return;
    }

    if (!cleanEmail.endsWith(`@${officialDomain}`)) {
      toast.error(`Email must end with official organization domain (@${officialDomain}).`);
      return;
    }

    setRequestingEmail(true);
    try {
      const res = await apiFetch("/users/me/email-change/request", {
        method: "POST",
        body: JSON.stringify({ new_email: cleanEmail })
      });

      toast.success(res.message || `Verification code sent to ${cleanEmail}`);
      setPendingEmail(cleanEmail);
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate email change.");
    } finally {
      setRequestingEmail(false);
    }
  };

  // Step 2: Verify Email Change OTP
  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setVerifyingEmail(true);
    try {
      const res = await apiFetch("/users/me/email-change/verify", {
        method: "POST",
        body: JSON.stringify({ otp: emailOtp.trim() })
      });

      toast.success(res.message || "Email address updated successfully!");
      setPendingEmail(null);
      setNewEmail("");
      setEmailOtp("");
      fetchUserData();
      if (onUserUpdated) {
        onUserUpdated({ ...user, email: res.email });
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid or expired verification code.");
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Resend Email OTP
  const handleResendEmailOtp = async () => {
    setResendingOtp(true);
    try {
      const res = await apiFetch("/users/me/email-change/resend", {
        method: "POST"
      });
      toast.success(res.message || "New verification code sent.");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code.");
    } finally {
      setResendingOtp(false);
    }
  };

  // Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch("/users/me/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: oldPassword,
          new_password: newPassword
        })
      });
      toast.success("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="Avatar" className="w-full h-full rounded-xl object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Edit Profile & Info
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase bg-primary/15 text-primary border border-primary/20">
                  {user?.role || "User"}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Keep your institutional credentials, contact info, and email updated.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-6 gap-6 bg-slate-50/20 dark:bg-slate-900/20 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-4 h-4" />
            General Information
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "email"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="w-4 h-4" />
            Institutional Email & Verification
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "security"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Security & Password
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* TAB 1: General Info */}
              {activeTab === "general" && (
                <form onSubmit={handleSaveGeneral} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Phone Number
                      </label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Institutional ID / Roll Number
                      </label>
                      <Input
                        disabled
                        value={user?.roll_number || "N/A"}
                        className="bg-slate-100 dark:bg-slate-900 font-mono text-xs cursor-not-allowed text-muted-foreground"
                      />
                      <p className="text-[0.68rem] text-muted-foreground">ID is managed by college administration.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Department
                      </label>
                      <Input
                        disabled
                        value={user?.department || "Unassigned"}
                        className="bg-slate-100 dark:bg-slate-900 text-xs cursor-not-allowed text-muted-foreground"
                      />
                      <p className="text-[0.68rem] text-muted-foreground">Department affiliation is bound to academic record.</p>
                    </div>
                  </div>

                  {user?.role === "student" && (
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Academic Class Year
                      </label>
                      <Input
                        value={classYear}
                        onChange={(e) => setClassYear(e.target.value)}
                        placeholder="e.g. 2nd Year / Semester 4"
                      />
                    </div>
                  )}

                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button type="submit" disabled={savingGeneral} className="gap-2 bg-primary hover:bg-primary/90">
                      {savingGeneral ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile Changes
                    </Button>
                  </div>
                </form>
              )}

              {/* TAB 2: Institutional Email & Verification */}
              {activeTab === "email" && (
                <div className="space-y-5">
                  {/* Current Email Status */}
                  <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Current Primary Email
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  </div>

                  {/* Domain Compliance Notice */}
                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Institutional Domain Requirement:</span> All updated email addresses must belong to the approved college domain:{" "}
                      <span className="font-mono font-bold bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-100">
                        @{officialDomain}
                      </span>
                      . A 6-digit OTP verification code will be dispatched to verify mailbox ownership.
                    </div>
                  </div>

                  {/* Flow: Step 1 or Step 2 */}
                  {!pendingEmail ? (
                    <form onSubmit={handleRequestEmailChange} className="space-y-3 border-t border-border pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-primary" />
                        Request Email Change
                      </h3>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          New Email Address <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          required
                          type="email"
                          placeholder={`username@${officialDomain}`}
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                        />
                        <p className="text-[0.68rem] text-muted-foreground">
                          Example format: <code className="text-primary font-mono">{user?.full_name?.toLowerCase().replace(/\s+/g, '.') || "student"}@{officialDomain}</code>
                        </p>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={requestingEmail} 
                          className="gap-2 bg-primary hover:bg-primary/90 text-xs"
                        >
                          {requestingEmail ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending OTP Code...
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              Send Verification Code
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyEmailChange} className="space-y-4 border-t border-border pt-4 animate-in fade-in">
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>
                            Verification code dispatched to <strong>{pendingEmail}</strong>
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingEmail(null)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Change Target
                        </Button>
                      </div>

                      <div className="space-y-1.5 max-w-xs mx-auto text-center">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Enter 6-Digit Verification Code
                        </label>
                        <Input
                          required
                          maxLength={6}
                          placeholder="------"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                          className="text-center font-mono text-xl tracking-[0.5em] font-bold h-12"
                        />
                        <p className="text-[0.7rem] text-muted-foreground mt-1">
                          Code expires in 10 minutes.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resendingOtp}
                          onClick={handleResendEmailOtp}
                          className="gap-1.5 text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${resendingOtp ? "animate-spin" : ""}`} />
                          Resend Code
                        </Button>

                        <Button 
                          type="submit" 
                          disabled={verifyingEmail || emailOtp.length !== 6}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          {verifyingEmail ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verify & Update Email
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: Security & Password */}
              {activeTab === "security" && (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Current Password <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      required
                      type="password"
                      placeholder="Enter current password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        New Password <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        required
                        type="password"
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Confirm New Password <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        required
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button type="submit" disabled={savingPassword} className="gap-2 bg-primary hover:bg-primary/90">
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Update Password
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
