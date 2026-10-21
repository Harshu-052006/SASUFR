import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";


export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // The API expects a JSON payload for login
      const res: any = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (res?.access_token) {
        localStorage.setItem("access_token", res.access_token);
      }
      
      // Check user role to redirect appropriately
      const user = await apiFetch("/users/me");
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "teacher") navigate("/teacher");
      else navigate("/student");
      
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col space-y-2 text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
            Email address
          </label>
          <Input 
            id="email" 
            placeholder="name@example.com" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
              Password
            </label>
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
                    <Input 
            id="password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        <Button 
          className="w-full mt-8 bg-gradient-to-br from-[#06B6D4] to-[#6366F1] text-white font-extrabold uppercase tracking-wider shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(99,102,241,0.4)] transition-all border-none" 
          type="submit" 
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Sign In
        </Button>
      </form>
      
      <p className="px-8 text-center text-sm text-[#94A3B8] mt-8">
        Don't have an account?{" "}
        <Link to="/register" className="text-[#06B6D4] hover:text-[#00D1C7] font-bold underline underline-offset-4">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
