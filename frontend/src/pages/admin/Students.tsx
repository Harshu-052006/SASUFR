import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Search, CheckCircle, Upload } from "lucide-react";
import { apiFetch } from "../../lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { toast } from "sonner";

export function Students() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");
  
  // Pending approvals modal state
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/admin/users");
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const data = await apiFetch("/admin/pending_approvals");
      setPendingApprovals(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (userId: number) => {
    try {
      await apiFetch("/admin/approve", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, admin_password: adminPassword })
      });
      fetchPendingApprovals();
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve")
    }
  };

  const handleCSVImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await apiFetch("/admin/import_students", {
        method: "POST",
        body: formData // Let api utility handle Content-Type removal for FormData
      });
      toast.success("Import successful")
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Import failed")
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = (u.full_name || "").toLowerCase().includes(search.toLowerCase()) || 
                          (u.roll_number || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole ? u.role === filterRole : true;
    const matchesDept = filterDept ? u.department === filterDept : true;
    return matchesSearch && matchesRole && matchesDept;
  });

  return (
    <DashboardLayout title="User Management">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full max-w-sm flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={fetchPendingApprovals}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approvals
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pending Approvals</DialogTitle>
                  <DialogDescription>Review and approve faculty registrations.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input 
                    type="password" 
                    placeholder="Admin Password required for actions" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)} 
                  />
                  {pendingApprovals.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pending approvals.</p>
                  ) : (
                    pendingApprovals.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{p.full_name} ({p.role})</p>
                          <p className="text-sm text-muted-foreground">{p.email} - {p.department}</p>
                        </div>
                        <Button size="sm" onClick={() => handleApprove(p.id)}>Approve</Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Students</DialogTitle>
                  <DialogDescription>Upload a CSV file containing student details.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCSVImport} className="space-y-4 py-4">
                  <Input type="file" name="file" accept=".csv" required />
                  <Button type="submit" className="w-full">Upload and Import</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>Manage your institution's users.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
               <select 
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterRole} onChange={e => setFilterRole(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
               </select>
               <select 
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterDept} onChange={e => setFilterDept(e.target.value)}
                >
                  <option value="">All Departments</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Electronics">Electronics</option>
               </select>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.roll_number || user.id}</TableCell>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              user.is_active
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
