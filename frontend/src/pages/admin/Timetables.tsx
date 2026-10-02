import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { apiFetch } from "../../lib/api";
import { Loader2, Plus, Upload, Search, Trash2, Calendar, Clock, BookOpen } from "lucide-react";
import { toast } from "sonner";

export function Timetables() {
  const [timetables, setTimetables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const [form, setForm] = useState({ subject: "", room_id: "", teacher_name: "", start_time: "", end_time: "", date: "" });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/admin/timetables");
      setTimetables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/admin/timetables", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setIsAddModalOpen(false);
      setForm({ subject: "", room_id: "", teacher_name: "", start_time: "", end_time: "", date: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create timetable")
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this timetable entry?")) return;
    try {
      await apiFetch(`/admin/timetables/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete")
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setSaving(true);
    try {
      const resp = await fetch("http://127.0.0.1:8000/admin/timetables/import", {
        method: "POST",
        body: formData,
        // credentials: "include" - depending on setup
      });
      if (!resp.ok) throw new Error("Failed to upload file");
      toast.success("Timetables imported successfully")
      setIsUploadModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = timetables.filter(t => 
    (t.subject || "").toLowerCase().includes(search.toLowerCase()) || 
    (t.teacher_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Timetables">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <Card className="border-border shadow-sm">
          <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div className="relative w-full sm:max-w-md">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Search subject or teacher..." 
                 className="pl-9 bg-slate-50 border-slate-200"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsUploadModalOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" /> Import CSV
                </Button>
                <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Entry
                </Button>
             </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No timetables found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(tt => (
                    <TableRow key={tt.id}>
                      <TableCell className="font-medium">
                         <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {tt.date}</div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {tt.start_time} - {tt.end_time}</div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-1 font-semibold text-slate-800"><BookOpen className="w-3 h-3 text-indigo-400" /> {tt.subject}</div>
                      </TableCell>
                      <TableCell>{tt.room_id}</TableCell>
                      <TableCell className="text-slate-500">{tt.teacher_name}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleDelete(tt.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>

      {/* Add Entry Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Timetable Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
                <Input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Subject</label>
                <Input required placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Start Time</label>
                <Input type="time" required value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">End Time</label>
                <Input type="time" required value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Room ID</label>
                <Input required placeholder="e.g. R-101" value={form.room_id} onChange={e => setForm({...form, room_id: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Teacher Name</label>
                <Input required placeholder="e.g. Dr. Smith" value={form.teacher_name} onChange={e => setForm({...form, teacher_name: e.target.value})} />
              </div>
            </div>
            
            <Button type="submit" disabled={saving} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Entry
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload CSV Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Timetables via CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with headers: date, start_time, end_time, subject, room_id, teacher_name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".csv" ref={fileInputRef} onChange={handleUpload} disabled={saving} />
            {saving && <p className="text-sm text-indigo-600 animate-pulse">Uploading...</p>}
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
