
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation */}
      <nav className="h-16 flex items-center justify-between px-6 lg:px-12 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold">S</span>
          </div>
          <span className="font-bold text-xl tracking-tight">SmartFace</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/login">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight max-w-4xl">
          Automate Attendance with <span className="text-primary">Face Recognition</span>
        </h1>
        <p className="mt-8 text-xl text-muted-foreground max-w-2xl">
          The most secure, fast, and reliable way to manage attendance for schools and universities. 
          No more manual roll calls. No more buddy punching.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/login">
            <Button size="lg" className="h-12 px-8 text-lg w-full sm:w-auto">
              Start Using SmartFace
            </Button>
          </Link>
          <a href="#features">
            <Button size="lg" variant="outline" className="h-12 px-8 text-lg w-full sm:w-auto">
              Learn More
            </Button>
          </a>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t">
        &copy; {new Date().getFullYear()} SmartFace Systems. All rights reserved.
      </footer>
    </div>
  );
}
