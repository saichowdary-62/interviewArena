import React from 'react';
import { Video, Bell, Building2, User, LogOut, LogIn } from 'lucide-react';
import { NavigationTab } from '../types';
import { AuthUser } from '../lib/database';

interface HeaderProps {
  currentTab: NavigationTab;
  onStartInterview: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onStartInterview,
  onSelectTab,
  currentUser,
  onOpenAuthModal,
  onSignOut,
}) => {
  const getTabDetails = (tab: NavigationTab) => {
    switch (tab) {
      case 'dashboard':
        return {
          title: 'Candidate Overview',
          subtitle: 'Real-time readiness telemetry & benchmark metrics',
        };
      case 'interviews':
        return {
          title: 'Interview Arena Simulation',
          subtitle: 'Realistic split-screen mock evaluation session',
        };
      case 'resume':
        return {
          title: 'Resume & Competency Analysis',
          subtitle: 'Deterministic skill extraction and role gap diagnostics',
        };
      case 'reports':
        return {
          title: 'Placement Readiness Reports',
          subtitle: 'Multi-dimensional radar diagnostics & improvement roadmaps',
        };
      case 'settings':
        return {
          title: 'Candidate Preferences & Hardware',
          subtitle: 'Role tracks, target companies, and device calibration',
        };
      default:
        return {
          title: 'Interview Arena',
          subtitle: 'Placement Readiness Platform',
        };
    }
  };

  const details = getTabDetails(currentTab);

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between z-20 shrink-0">
      {/* Left Title & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#64748B]">
            Interview Arena
          </span>
          <span className="text-xs text-slate-300">/</span>
          <h1 className="text-sm font-semibold text-[#0F172A]">
            {details.title}
          </h1>
        </div>
        <p className="text-[11px] text-[#64748B] hidden sm:block">
          {details.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Placement Track Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A]">
          <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="text-[11px] text-[#64748B]">Benchmark:</span>
          <span className="font-semibold text-[11px]">Tier-1 Product & Fintech</span>
        </div>

        {/* View Landing Toggle */}
        <button
          onClick={() => onSelectTab('landing')}
          className="hidden md:inline-flex items-center text-xs font-semibold text-slate-600 hover:text-[#0F172A] px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          Product Landing
        </button>

        {/* Notification indicator */}
        <button
          onClick={() => onSelectTab('reports')}
          title="Placement Cell Notifications"
          className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-lg transition relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#2563EB] rounded-full" />
        </button>

        {/* Authentication Button / User Profile */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div
              onClick={() => onSelectTab('settings')}
              className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 hover:text-[#0F172A]"
              title={currentUser.email}
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-semibold">{currentUser.name.split(' ')[0]}</span>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-blue-100 transition border border-blue-200"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}

        {/* Primary CTA */}
        {currentTab !== 'interviews' && (
          <button
            onClick={onStartInterview}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition active:scale-95"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Start Mock Interview</span>
          </button>
        )}
      </div>
    </header>
  );
};

