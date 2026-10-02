import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Users, ShieldAlert, BarChart3, Shield, Settings, User, Calendar } from "lucide-react";
import gsap from "gsap";

export function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance animation for text
      gsap.fromTo(
        ".hero-text-element",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "power3.out" }
      );
      
      // Entrance animation for mockup
      gsap.fromTo(
        mockupRef.current,
        { x: 50, opacity: 0, rotateY: 15 },
        { x: 0, opacity: 1, rotateY: -5, duration: 1, delay: 0.3, ease: "power3.out" }
      );
    }, heroRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC] flex flex-col overflow-hidden font-sans">
      {/* Navigation */}
      <nav className="h-20 flex items-center justify-between px-6 lg:px-12 border-b border-[#2A3854] bg-[#0B0F17]/85 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-[1.8rem] font-extrabold text-[#06B6D4] tracking-[-1px]">
            SmartFace
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login">
            <button className="px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-[#94A3B8] hover:text-white transition-colors">
              Log in
            </button>
          </Link>
          <Link to="/login">
            <button className="px-6 py-2 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white bg-gradient-to-br from-[#06B6D4] to-[#6366F1] shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:scale-105 transition-transform duration-300">
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main ref={heroRef} className="flex-1 w-full max-w-[1400px] mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center justify-center gap-16 py-12 lg:py-0">
        
        {/* Left Column: Copy */}
        <div ref={textRef} className="flex-1 max-w-2xl text-center lg:text-left z-10 pt-12 lg:pt-0">
          <div className="hero-text-element inline-block mb-4 px-4 py-1.5 rounded-full border border-[#2A3854] bg-white/5 text-xs font-bold text-[#06B6D4] tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            Enterprise Grade System
          </div>
          <h1 className="hero-text-element text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
            Automate Attendance with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#06B6D4] to-[#6366F1]">Face Recognition</span>
          </h1>
          <p className="hero-text-element text-lg lg:text-xl text-[#94A3B8] mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            The most secure, fast, and reliable way to manage attendance for schools and universities. 
            No more manual roll calls. No more buddy punching.
          </p>
          <div className="hero-text-element flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
            <Link to="/login">
              <button className="w-full sm:w-auto px-8 py-4 rounded-xl text-[15px] font-extrabold uppercase tracking-wider text-white bg-gradient-to-br from-[#06B6D4] to-[#6366F1] shadow-[0_12px_32px_rgba(99,102,241,0.4)] hover:shadow-[0_16px_40px_rgba(99,102,241,0.5)] hover:-translate-y-1 transition-all duration-300">
                Start Using SmartFace
              </button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-8 py-4 rounded-xl text-[15px] font-extrabold uppercase tracking-wider text-white bg-white/5 border border-[#2A3854] backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                Learn More
              </button>
            </a>
          </div>
        </div>

        {/* Right Column: Dashboard Mockup */}
        <div className="flex-1 w-full max-w-3xl perspective-[2000px] mt-12 lg:mt-0 relative">
          <div 
            ref={mockupRef} 
            className="w-full rounded-2xl border border-[#2A3854] bg-[#161F30] shadow-[0_40px_96px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] overflow-hidden flex flex-col"
            style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-5deg) rotateX(2deg)' }}
          >
            {/* Top Bar of Mockup */}
            <div className="h-14 border-b border-[#2A3854] bg-[#0B0F17]/80 flex items-center px-6 justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-extrabold text-[#06B6D4] tracking-tight">SmartFace <span className="ml-2 bg-[#EF4444] text-white text-[9px] px-2 py-0.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.4)] uppercase tracking-wider">ADMIN</span></span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 bg-white/5 rounded border border-[#2A3854]"></div>
                <div className="h-6 w-6 rounded-full bg-[#06B6D4] flex items-center justify-center">
                   <User size={12} className="text-black" />
                </div>
              </div>
            </div>

            {/* Main Content of Mockup */}
            <div className="flex flex-1 p-6 gap-6 bg-gradient-to-br from-[#161F30] to-[#0B0F17]">
              {/* Sidebar Miniature */}
              <div className="hidden sm:flex flex-col gap-4 w-12 pt-2">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-[#2A3854] flex items-center justify-center text-[#06B6D4]"><BarChart3 size={16} /></div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B]"><Users size={16} /></div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B]"><Calendar size={16} /></div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B]"><Shield size={16} /></div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B]"><Settings size={16} /></div>
              </div>

              {/* Main Panel */}
              <div className="flex-1 flex flex-col">
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="text-[10px] text-[#06B6D4] font-black uppercase tracking-[3px] mb-1">Attendance Analytics</h3>
                    <div className="text-[9px] px-3 py-1 rounded-full border border-[#06B6D4]/30 text-[#06B6D4] bg-[#06B6D4]/10 inline-block tracking-wider">REAL-TIME DATA</div>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Total Present */}
                  <div className="col-span-2 sm:col-span-1 p-5 rounded-xl border border-white/5 bg-white/[0.02] relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#10B981]"></div>
                    <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-[2px] mb-3">TOTAL PRESENT</p>
                    <h4 className="text-4xl font-black text-[#10B981] font-mono tracking-tight">312</h4>
                    <span className="inline-block mt-3 px-2 py-1 bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold rounded">+12% TODAY</span>
                  </div>

                  {/* Late */}
                  <div className="col-span-1 p-5 rounded-xl border border-white/5 bg-white/[0.02] relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#F59E0B]"></div>
                    <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-[2px] mb-3">LATE ARRIVALS</p>
                    <h4 className="text-4xl font-black text-[#F59E0B] font-mono tracking-tight">18</h4>
                    <span className="inline-block mt-3 px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold rounded">WARNING</span>
                  </div>

                  {/* Absent */}
                  <div className="col-span-1 p-5 rounded-xl border border-white/5 bg-white/[0.02] relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#EF4444]"></div>
                    <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-[2px] mb-3">ABSENT</p>
                    <h4 className="text-4xl font-black text-[#EF4444] font-mono tracking-tight">14</h4>
                    <span className="inline-block mt-3 px-2 py-1 bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold rounded">ACTION REQUIRED</span>
                  </div>
                </div>

                {/* Bottom Bar in Mockup */}
                <div className="mt-4 p-4 rounded-xl border border-[#EF4444]/50 bg-[#EF4444]/5 flex items-center gap-3">
                  <ShieldAlert className="text-[#EF4444]" size={20} />
                  <div>
                    <p className="text-[10px] text-[#EF4444] font-bold uppercase tracking-[1px] mb-0.5">Real-Time Alerts</p>
                    <p className="text-xs text-white font-bold">2 Low Confidence Scans <span className="text-[#EF4444] font-mono">(&lt; 85%)</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative glow behind the mockup */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-lg max-h-[500px] bg-gradient-to-r from-[#06B6D4]/20 to-[#6366F1]/20 blur-[100px] -z-10 rounded-full opacity-60 pointer-events-none"></div>
        </div>

      </main>
      
      {/* Footer */}
      <footer className="py-8 text-center text-sm text-[#64748B] border-t border-[#2A3854] bg-[#0B0F17] relative z-10">
        &copy; {new Date().getFullYear()} SmartFace Systems. All rights reserved.
      </footer>
    </div>
  );
}
