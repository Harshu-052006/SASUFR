import React from "react";
import { ThemeToggle } from "../components/theme-toggle";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branded Area */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/5 flex-col justify-between p-12 border-r">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-2xl tracking-tight text-primary">SmartFace</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mt-20">
            Secure, AI-Powered <br />
            <span className="text-primary">Attendance Management</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Streamline your institution's attendance tracking with facial recognition. 
            Fast, accurate, and completely automated.
          </p>
        </div>
        
        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SmartFace Systems. All rights reserved.
        </div>
      </div>

      {/* Right side - Form Area */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 xl:px-24">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {children}
        </div>
      </div>
    </div>
  );
}
