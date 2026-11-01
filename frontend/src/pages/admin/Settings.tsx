import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Save } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { toast } from "sonner";

export function Settings() {
  const [config, setConfig] = useState<any>({
    face_tolerance: 0.45,
    campus_lat: 0,
    campus_lon: 0,
    max_distance_km: 1.0,
    mfa_enabled: false,
    lockout_enabled: false
  });
  
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await apiFetch("/admin/config");
      setConfig(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      toast.error("Admin password is required to save changes.")
      return;
    }
    
    try {
      await apiFetch("/admin/config", {
        method: "PATCH",
        body: JSON.stringify({
          ...config,
          admin_password: adminPassword
        })
      });
      toast.success("Settings saved successfully.")
      setAdminPassword(""); // Clear password field after save
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings.")
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev: any) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseFloat(value) : value
    }));
  };

  return (
    <DashboardLayout title="System Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-border shadow-sm">
          <form onSubmit={handleSave}>
            <CardHeader>
              <CardTitle>Global Configurations</CardTitle>
              <CardDescription>
                Manage system-wide parameters for face recognition and attendance logic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {loading ? (
                <p>Loading...</p>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium leading-none">Face Recognition</h3>
                    <div className="space-y-2 max-w-sm">
                      <label className="text-sm font-medium leading-none">Tolerance Level</label>
                      <Input 
                        type="number" 
                        step="0.01" min="0.1" max="1.0" 
                        name="face_tolerance"
                        value={config.face_tolerance || ""} 
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium leading-none">Geofencing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Latitude</label>
                        <Input type="number" step="any" name="campus_lat" value={config.campus_lat || 0} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Longitude</label>
                        <Input type="number" step="any" name="campus_lon" value={config.campus_lon || 0} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Radius (km)</label>
                        <Input type="number" step="0.1" name="max_distance_km" value={config.max_distance_km || 1} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium leading-none">Organization Domain</h3>
                    <p className="text-sm text-muted-foreground">Students with this email domain (e.g. <code>mit.asia</code>) can register even if their roll number is not yet on the whitelist.</p>
                    <div className="space-y-2 max-w-sm">
                      <label className="text-sm font-medium leading-none">Official Domain</label>
                      <Input 
                        type="text" 
                        name="official_domain" 
                        placeholder="e.g. mit.asia" 
                        value={config.official_domain || ""} 
                        onChange={handleChange} 
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <h3 className="text-lg font-medium leading-none">Security & Access Controls</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Disable Geofencing during development to mark attendance from anywhere without location errors.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div className="flex items-center space-x-2 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/40">
                        <input 
                          type="checkbox" 
                          id="geofencing" 
                          name="geofencing_enabled" 
                          checked={config.geofencing_enabled || false} 
                          onChange={handleChange} 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                        />
                        <label htmlFor="geofencing" className="text-sm font-medium leading-none cursor-pointer">
                          Campus Geofencing
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/40">
                        <input 
                          type="checkbox" 
                          id="mfa" 
                          name="mfa_enabled" 
                          checked={config.mfa_enabled || false} 
                          onChange={handleChange} 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                        />
                        <label htmlFor="mfa" className="text-sm font-medium leading-none cursor-pointer">
                          Enable MFA
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/40">
                        <input 
                          type="checkbox" 
                          id="lockout" 
                          name="lockout_enabled" 
                          checked={config.lockout_enabled || false} 
                          onChange={handleChange} 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                        />
                        <label htmlFor="lockout" className="text-sm font-medium leading-none cursor-pointer">
                          Account Lockout
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium leading-none text-red-600">Admin Authorization</h3>
                    <p className="text-sm text-muted-foreground">Provide your password to confirm these changes.</p>
                    <div className="space-y-2 max-w-sm">
                      <Input type="password" placeholder="Admin Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6 mt-2">
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
