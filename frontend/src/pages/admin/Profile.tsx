import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Save, UserCog, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { EditProfileModal } from "../../components/EditProfileModal";

export function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiFetch("/users/me");
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", type: "error" });
      return;
    }
    
    try {
      await apiFetch("/users/me/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      setPasswordMessage({ text: "Password successfully changed.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({ text: err.message || "Failed to change password.", type: "error" });
    }
  };

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>Your personal administrator credentials and contact details.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditModal(true)}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:border-primary/50"
            >
              <UserCog className="w-3.5 h-3.5 text-primary" />
              Edit Profile & Email
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <p>Loading...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : profile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Full Name</label>
                  <Input type="text" value={profile.full_name || ""} disabled className="bg-slate-50 dark:bg-slate-900" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none flex items-center gap-2">
                    Email Address
                    <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  </label>
                  <Input type="email" value={profile.email || ""} disabled className="bg-slate-50 dark:bg-slate-900" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Role</label>
                  <Input type="text" value={(profile.role || "Admin").toUpperCase()} disabled className="bg-slate-50 dark:bg-slate-900" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Contact Phone</label>
                  <Input type="text" value={profile.phone || "Not set"} disabled className="bg-slate-50 dark:bg-slate-900" />
                </div>
                {profile.department && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Department</label>
                    <Input type="text" value={profile.department} disabled className="bg-slate-50 dark:bg-slate-900" />
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onUserUpdated={(updated) => setProfile(updated)}
        />

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
          </CardHeader>
          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4">
              {passwordMessage.text && (
                <div className={`p-3 rounded-md text-sm ${passwordMessage.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {passwordMessage.text}
                </div>
              )}
              <div className="space-y-2 max-w-sm">
                <label className="text-sm font-medium leading-none">Current Password</label>
                <Input 
                  type="password" 
                  required 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-w-sm">
                <label className="text-sm font-medium leading-none">New Password</label>
                <Input 
                  type="password" 
                  required 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-w-sm">
                <label className="text-sm font-medium leading-none">Confirm New Password</label>
                <Input 
                  type="password" 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6 mt-2">
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Update Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
