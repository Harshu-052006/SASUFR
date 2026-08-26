import { useState, useEffect } from "react";
import { Megaphone, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";

interface Announcement {
  id: string;
  department: string;
  message: string;
  timestamp: string;
  expires_at?: string;
}

// TODO: Swap the implementation of this function to hit the real endpoint later
export async function fetchActiveAnnouncement(): Promise<Announcement | null> {
  // Mocked response for now since bm1-3.1a-hod-announcements-api isn't available
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: "ann-101",
        department: "CSE",
        message: "Important updates regarding the upcoming semester schedule have been posted.",
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        expires_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      });
    }, 500); // simulate network delay
  });
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
  const timeStr = new Date(announcement.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
      <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div className="flex justify-between items-start ml-2">
          <div className="flex-1">
            <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold flex items-center gap-2">
              Department Announcement 
              <span className="text-xs font-normal text-blue-600/70 dark:text-blue-400/70 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                {announcement.department}
              </span>
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-200 mt-1 mr-6">
              {announcement.message}
              <div className="text-xs text-blue-500/80 dark:text-blue-400/80 mt-2 font-medium">
                Posted today at {timeStr}
              </div>
            </AlertDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-blue-500 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-300 absolute right-3 top-3 rounded-full"
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
