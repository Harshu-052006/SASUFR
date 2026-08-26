import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiFetch } from "../lib/api";
import { ShieldCheck, Loader2 } from "lucide-react";

export function Otp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    if (!email) {
      navigate("/login");
    }
  }, [email, navigate]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(r => r - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch("/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      // Verification successful, redirect to login
      navigate("/login?verified=true");
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await apiFetch("/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setResendTimer(60);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-8">
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Verify Email</h2>
          <p className="text-slate-500 text-sm mt-2">
            We've sent a 6-digit code to <br/> <strong className="text-slate-700">{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <Input 
              type="text" 
              placeholder="000000" 
              required 
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />
          </div>

          <Button type="submit" disabled={loading || otp.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-sm font-bold tracking-wide">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Verify Account"}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={handleResend}
            disabled={resendTimer > 0}
            className={`text-sm font-medium ${resendTimer > 0 ? "text-slate-400" : "text-indigo-600 hover:text-indigo-500"}`}
          >
            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
