import React from "react";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Menu, ShieldAlert } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  role?: string;
}

export function Sidebar({ isOpen, setIsOpen, role }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiFetch("/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout failed or session already invalid", err);
    } finally {
      navigate("/login");
    }
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300 ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      <div className="flex items-center h-16 px-4 border-b">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        {isOpen && (
          <div className="ml-3 font-bold text-xl tracking-tight text-primary truncate">
            SmartFace
          </div>
        )}
      </div>

      <nav className="flex-1 py-6 px-2 space-y-2 overflow-y-auto">
        {role === "admin" && (
          <>
            <SidebarItem icon={<LayoutDashboard />} label="Dashboard" to="/admin" isOpen={isOpen} end />
            <SidebarItem icon={<Users />} label="Students" to="/admin/students" isOpen={isOpen} />
            <SidebarItem icon={<FileText />} label="Timetables" to="/admin/timetables" isOpen={isOpen} />
            <SidebarItem icon={<FileText />} label="Reports" to="/admin/reports" isOpen={isOpen} />
            <SidebarItem icon={<ShieldAlert />} label="Security" to="/admin/security" isOpen={isOpen} />
            <SidebarItem icon={<Settings />} label="Settings" to="/admin/settings" isOpen={isOpen} />
          </>
        )}
        {role === "student" && (
          <>
            <SidebarItem icon={<LayoutDashboard />} label="Overview" to="/student" isOpen={isOpen} end />
            <SidebarItem icon={<Users />} label="My Identity" to="/student/profile" isOpen={isOpen} />
            <SidebarItem icon={<Settings />} label="Preferences" to="/student/settings" isOpen={isOpen} />
          </>
        )}
        {role === "teacher" && (
          <>
            <SidebarItem icon={<LayoutDashboard />} label="Dashboard" to="/teacher" isOpen={isOpen} end />
            <SidebarItem icon={<Users />} label="Manual Override" to="/teacher/mark-attendance" isOpen={isOpen} />
            <SidebarItem icon={<FileText />} label="Students" to="/teacher/students" isOpen={isOpen} />
            <SidebarItem icon={<FileText />} label="View Attendance" to="/teacher/attendance" isOpen={isOpen} />
            <SidebarItem icon={<FileText />} label="Reports" to="/teacher/reports" isOpen={isOpen} />
            <SidebarItem icon={<Settings />} label="Settings" to="/teacher/settings" isOpen={isOpen} />
          </>
        )}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground ${!isOpen ? "justify-center" : ""}`}
          title={!isOpen ? "Log Out" : undefined}
        >
          <div className="shrink-0"><LogOut /></div>
          {isOpen && <span className="font-medium text-sm whitespace-nowrap">Log Out</span>}
        </button>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, to, isOpen, end = false }: { icon: React.ReactNode; label: string; to: string; isOpen: boolean; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2 py-2 rounded-md transition-colors ${
          isActive 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        } ${!isOpen ? "justify-center" : ""}`
      }
      title={!isOpen ? label : undefined}
    >
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
    </NavLink>
  );
}
