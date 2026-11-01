import React, { useState, useEffect } from "react";
import { Sidebar } from "../components/Sidebar";
import { ThemeToggle } from "../components/theme-toggle";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { CircleUserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Auth Guard: check if session is valid
    const checkAuth = async () => {
      try {
        const data = await apiFetch("/users/me");
        setUser(data);
      } catch (err) {
        console.error("Auth check failed", err);
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await apiFetch("/logout", { method: "POST" });
    } catch (err) {
      // Ignore
    } finally {
      localStorage.removeItem("access_token");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-[#0B0F17] text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} role={user?.role} />
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <header className="h-16 flex items-center px-8 justify-between bg-white/80 dark:bg-[#111726]/80 border-b border-slate-200 dark:border-border/60 z-40 sticky top-0 backdrop-blur-md shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          <div className="flex items-center gap-3">
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-muted p-1.5 pr-3 rounded-full transition-colors outline-none focus:ring-2 focus:ring-ring">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt="Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <CircleUserRound className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[120px] truncate">
                    {user?.full_name || user?.email || "Loading..."}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.full_name || "My Account"}</span>
                  <span className="text-[0.7rem] font-normal text-muted-foreground truncate">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role && (
                  <>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to={`/${user.role}/profile`}>Profile Overview</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to={`/${user.role}/settings`}>Account Settings</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle />
          </div>
        </header>
        
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
