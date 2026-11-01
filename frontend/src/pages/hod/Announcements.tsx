import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { apiFetch } from "../../lib/api";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Clock, 
  Send, 
  X,
  Calendar,
  Search
} from "lucide-react";
import { toast } from "sonner";

export function HODAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [duration, setDuration] = useState("24");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const data = await apiFetch("/hod/announcements");
      setAnnouncements(data || []);
    } catch (err) {
      console.error("Failed to load announcements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a notice message");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch("/hod/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || "Department Announcement",
          message: message.trim(),
          priority,
          duration_hours: parseInt(duration) || 24
        })
      });
      toast.success("Department notice published!");
      setShowModal(false);
      setTitle("");
      setMessage("");
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish notice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpireAnnouncement = async (id: number) => {
    try {
      await apiFetch(`/hod/announcements/${id}/expire`, { method: "PATCH" });
      toast.success("Announcement marked as expired");
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to expire announcement");
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
    try {
      await apiFetch(`/hod/announcements/${id}`, { method: "DELETE" });
      toast.success("Notice deleted");
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notice");
    }
  };

  const filteredAnnouncements = announcements.filter(a => 
    (a.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (a.message?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Department Announcement Hub">
      <div className="space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">HOD Notice Center</h2>
            <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">
              Broadcast critical department-wide announcements, exam alerts, and schedule updates.
            </p>
          </div>
          <Button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md shadow-blue-500/20 font-semibold"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-muted-foreground absolute left-3 top-3.5" />
            <Input 
              placeholder="Search announcements by title or content..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-white dark:bg-card border-slate-200/80 dark:border-border text-slate-900 dark:text-slate-100 shadow-sm"
            />
          </div>
        </div>

        {/* Announcement Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnnouncements.map((ann) => (
            <Card 
              key={ann.id}
              className={`bg-white dark:bg-card border shadow-sm transition-all hover:shadow-md ${
                ann.is_active 
                  ? "border-blue-200 dark:border-blue-500/30" 
                  : "border-slate-200/70 dark:border-border opacity-70"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ann.is_active 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" 
                          : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground"
                      }`}>
                        {ann.is_active ? "● Live / Active" : "Expired"}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-muted-foreground bg-slate-100 dark:bg-muted px-2 py-0.5 rounded-md font-mono border border-slate-200 dark:border-border">
                        {ann.department}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-foreground pt-1">
                      {ann.title || "Department Notice"}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-700 dark:text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {ann.message}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-border flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-muted-foreground gap-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Posted: {new Date(ann.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires: {new Date(ann.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {ann.is_active && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleExpireAnnouncement(ann.id)}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 dark:text-amber-400 dark:hover:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20"
                    >
                      Expire Now
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-red-400 dark:hover:text-red-300 dark:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredAnnouncements.length === 0 && !loading && (
            <div className="col-span-full text-center py-12 border border-dashed border-slate-200 dark:border-border rounded-2xl bg-white dark:bg-card">
              <Megaphone className="w-12 h-12 text-slate-400 dark:text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="font-bold text-lg text-slate-800 dark:text-foreground">No announcements found</h3>
              <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">
                {searchQuery ? "No notices match your search." : "Create your first department announcement to alert students and teachers."}
              </p>
              <Button 
                onClick={() => setShowModal(true)} 
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Broadcast Notice
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-border flex items-center justify-between bg-slate-50/80 dark:bg-[#161F30]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-lg">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-foreground">Create Department Notice</h3>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Broadcasted to student & faculty dashboards</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-muted-foreground dark:hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Title</label>
                <Input 
                  placeholder="e.g. Mid-term Exam Schedule Announced"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white dark:bg-background border-slate-300 dark:border-input text-slate-900 dark:text-slate-100 h-11"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Priority / Category</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Normal">General Notice</option>
                    <option value="Urgent">Urgent Alert</option>
                    <option value="Exam">Exam / Academic</option>
                    <option value="Event">Department Event</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Duration</label>
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours (1 Day)</option>
                    <option value="72">3 Days</option>
                    <option value="168">7 Days (1 Week)</option>
                    <option value="720">30 Days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Notice Message</label>
                <textarea 
                  rows={4}
                  placeholder="Detailed announcement text..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background text-slate-900 dark:text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowModal(false)}
                  className="border-slate-300 dark:border-input"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-md shadow-blue-500/20"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Publishing..." : "Publish Notice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
