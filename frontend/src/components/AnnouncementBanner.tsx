import { useState, useEffect } from "react";
import { Megaphone, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { apiFetch } from "../lib/api";

interface Announcement {
  id: string | number;
  department: string;
  message: string;
  created_at: string;
  created_by?: string | number;
  expires_at: string;
}

export async function fetchActiveAnnouncement(): Promise<Announcement | null> {
  try {
    const data = await apiFetch("/announcements/active");
    if (Array.isArray(data) && data.length > 0) {
      return data[0]; // Assuming we only show the single most recent active announcement in the banner
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch announcements:", err);
    return null;
  }
}

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnnouncement = async () => {
      try {
        const data = await fetchActiveAnnouncement();
        setAnnouncement(data);
      } catch (error) {
        console.error("Failed to load announcement:", error);
      } finally {
        setLoading(false);
      }
    };
    loadAnnouncement();
  }, []);

  if (loading || !announcement || dismissed) return null;

  // Formatting date
  const timeStr = new Date(announcement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
      <Alert className="bg-blue-50/90 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60 shadow-sm relative overflow-hidden text-slate-900 dark:text-blue-100">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 dark:bg-blue-500"></div>
        <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div className="flex justify-between items-start ml-2">
          <div className="flex-1">
            <AlertTitle className="text-blue-900 dark:text-blue-200 font-bold flex items-center gap-2">
              Department Announcement 
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                {announcement.department}
              </span>
            </AlertTitle>
            <AlertDescription className="text-slate-700 dark:text-blue-100/90 mt-1.5 mr-6 leading-relaxed">
              {announcement.message}
              <div className="text-xs text-slate-500 dark:text-blue-300/70 mt-2 font-medium">
                Posted today at {timeStr}
              </div>
            </AlertDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-blue-100/80 dark:text-blue-300 dark:hover:bg-blue-900/80 dark:hover:text-blue-100 absolute right-3 top-3 rounded-full"
            onClick={() => setDismissed(true)}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
}
