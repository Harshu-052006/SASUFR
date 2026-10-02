import React from "react";
import { ThemeToggle } from "../components/theme-toggle";

interface AuthLayoutProps {
  children: React.ReactNode;
  leftContent?: React.ReactNode;
  maxWidthClass?: string;
}

export function AuthLayout({ children, leftContent, maxWidthClass = "max-w-sm lg:w-96" }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      {/* Left side - Branded Area */}
      <div className="hidden lg:flex lg:w-1/2 bg-muted/30 flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#06B6D4]/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#6366F1]/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <span className="text-[1.8rem] font-extrabold text-[#06B6D4] tracking-[-1px]">SmartFace</span>
          </div>
          {leftContent || (
            <>
              <h1 className="text-4xl font-extrabold tracking-tight mt-20 leading-tight">
                Secure, AI-Powered <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#06B6D4] to-[#6366F1]">Attendance Management</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-md">
                Streamline your institution's attendance tracking with facial recognition. 
                Fast, accurate, and completely automated.
              </p>
            </>
          )}
        </div>
        
        <div className="text-sm text-muted-foreground relative z-10">
          &copy; {new Date().getFullYear()} SmartFace Systems. All rights reserved.
        </div>
      </div>

      {/* Right side - Form Area */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 xl:px-24 bg-background relative z-10 overflow-y-auto">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className={`mx-auto w-full ${maxWidthClass} py-12`}>
          {children}
        </div>
      </div>
    </div>
  );
}
