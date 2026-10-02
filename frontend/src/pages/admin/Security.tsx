import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { Loader2, Key } from "lucide-react";
import { toast } from "sonner";

export function Security() {
  const [config, setConfig] = useState({
    mfa_enabled: false,
    geofencing_enabled: false,
    lockout_enabled: false
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      apiFetch("/admin/security-logs?limit=10").then(setLogs).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [confRes, logsRes] = await Promise.all([
        apiFetch("/admin/config").catch(() => null),
        apiFetch("/admin/security-logs?limit=50").catch(() => [])
      ]);
      if (confRes) {
        setConfig({
          mfa_enabled: !!confRes.mfa_enabled,
          geofencing_enabled: !!confRes.geofencing_enabled,
          lockout_enabled: !!confRes.lockout_enabled
        });
      }
      setLogs(logsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      toast.error("Admin password required to confirm changes.")
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/admin/config", {
        method: "PATCH",
        body: JSON.stringify({
          ...config,
          admin_password: adminPassword
        })
      });
      setAdminPassword("");
      toast.success("Security policies updated successfully.")
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update security policies.")
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Security Hub">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Policies */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg">Access Policies</CardTitle>
              <CardDescription>Configure system-wide security settings.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveConfig} className="space-y-6">
                
                <div className="space-y-4">
                  <label className="flex items-start justify-between cursor-pointer gap-4">
                    <div>
                      <div className="font-semibold text-slate-800">Multi-Factor Biometric Scan</div>
                      <div className="text-xs text-slate-500 mt-1">Requires 2FA for administrative access.</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={config.mfa_enabled} onChange={e => setConfig({...config, mfa_enabled: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>

                  <label className="flex items-start justify-between cursor-pointer gap-4">
                    <div>
                      <div className="font-semibold text-slate-800">Geo-Fencing Constraint</div>
                      <div className="text-xs text-slate-500 mt-1">Restrict attendance marking to campus location.</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={config.geofencing_enabled} onChange={e => setConfig({...config, geofencing_enabled: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>

                  <label className="flex items-start justify-between cursor-pointer gap-4">
                    <div>
                      <div className="font-semibold text-slate-800">Anomalous Access Lockout</div>
                      <div className="text-xs text-slate-500 mt-1">Auto suspend accounts after multiple failed tries.</div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={config.lockout_enabled} onChange={e => setConfig({...config, lockout_enabled: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2 block flex items-center gap-1">
                    <Key className="w-3 h-3" /> Admin Override Password
                  </label>
                  <Input 
                    type="password"
                    placeholder="Enter admin password to save"
                    required
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="border-rose-200 focus-visible:ring-rose-500"
                  />
                  <Button type="submit" disabled={saving} className="w-full mt-4 bg-rose-600 hover:bg-rose-700">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Confirm System Override
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Logs */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Security Audit Log</CardTitle>
              <div className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full uppercase tracking-wider">
                {logs.length} Events
              </div>
            </CardHeader>
            <div className="overflow-x-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Timestamp</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Target User</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        No security events recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => {
                      const isCritical = log.severity === 'critical';
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold text-xs px-2 py-1 rounded ${
                              isCritical ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {log.event_type}
                            </span>
                            <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={log.details}>
                              {log.details}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">
                            {log.target_user_id ? `User #${log.target_user_id}` : 'SYSTEM'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-xs uppercase tracking-widest text-slate-400">
                              Logged
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
