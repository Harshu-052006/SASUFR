import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent } from "../../components/ui/card";
import { apiFetch } from "../../lib/api";
import { Loader2, Fingerprint } from "lucide-react";

export function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const data = await apiFetch("/users/me");
      setUser(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="My Identity">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Identity">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
        
        {/* Virtual ID Card */}
        <div className="w-full max-w-sm">
          <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white relative group">
            {/* Holographic overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-teal-400/20 opacity-50 mix-blend-overlay group-hover:opacity-100 transition-opacity duration-700" />
            
            <CardContent className="p-0 relative z-10">
              <div className="bg-indigo-600/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-white/10">
                <div className="font-black tracking-widest text-sm uppercase">SmartFace ID</div>
                <div className="text-[0.65rem] opacity-70 tracking-widest">STUDENT</div>
              </div>
              
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full border-4 border-indigo-400/30 overflow-hidden bg-slate-800 shadow-inner flex items-center justify-center mb-6 relative">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-indigo-400">
                      {user?.full_name?.charAt(0) || "U"}
                    </span>
                  )}
                  {/* Subtle scan line animation */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-400/20 to-transparent h-[10%] w-full animate-[scan_2s_ease-in-out_infinite]" />
                </div>
                
                <h2 className="text-2xl font-black tracking-wide mb-1">{user?.full_name}</h2>
                <p className="text-indigo-300 font-medium text-sm mb-4 uppercase tracking-wider">{user?.department}</p>
                
                <div className="w-full grid grid-cols-2 gap-4 text-left border-t border-white/10 pt-6 mt-2">
                  <div>
                    <div className="text-[0.65rem] text-slate-400 uppercase tracking-widest mb-1">Roll Number</div>
                    <div className="font-mono text-sm font-bold">{user?.roll_number || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-slate-400 uppercase tracking-widest mb-1">Class Year</div>
                    <div className="font-mono text-sm font-bold">{user?.class_year || "N/A"}</div>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 px-6 py-4 flex items-center justify-between border-t border-white/10">
                 <Fingerprint className="w-6 h-6 text-indigo-400/70" />
                 <div className="font-mono text-[0.6rem] text-slate-500 tracking-[0.3em]">
                   {btoa(user?.email || "").substring(0, 20).toUpperCase()}
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Details */}
        <div className="w-full max-w-2xl mt-4">
          <Card className="shadow-sm">
            <CardContent className="p-6 space-y-4">
               <h3 className="text-lg font-bold border-b pb-2 mb-4">Personal Information</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                   <p className="mt-1 font-medium">{user?.email}</p>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Batch</label>
                   <p className="mt-1 font-medium">{user?.batch_id || "N/A"}</p>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                   <p className="mt-1">
                     <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                       Active
                     </span>
                   </p>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
