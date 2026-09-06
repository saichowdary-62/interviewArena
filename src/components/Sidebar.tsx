import React from 'react';
import {
  LayoutDashboard,
  Video,
  FileText,
  BarChart3,
  Settings,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { NavigationTab, CandidateProfile } from '../types';
import { AuthUser } from '../lib/database';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  candidate: CandidateProfile;
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  candidate,
  currentUser,
  onOpenAuthModal,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'interviews' as NavigationTab,
      label: 'Interviews',
      icon: Video,
      badge: 'Live',
    },
    {
      id: 'resume' as NavigationTab,
      label: 'Resume Analysis',
      icon: FileText,
      badge: 'Updated',
    },
    {
      id: 'reports' as NavigationTab,
      label: 'Reports',
      icon: BarChart3,
      badge: `${candidate.readinessScore}%`,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings',
      icon: Settings,
      badge: undefined,
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className="w-64 h-screen bg-white border-r border-[#E2E8F0] flex flex-col justify-between select-none z-30 shrink-0 p-6"
    >
      {/* Top Branding Section */}
      <div>
        <div
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 mb-8 cursor-pointer group"
        >
          {/* Editorial Arena Logo */}
          <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
            <div className="w-3.5 h-3.5 bg-white rounded-xs"></div>
          </div>

          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-xl tracking-tight text-[#0F172A]">
                Arena
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded ml-1">
                Pro
              </span>
            </div>
          </div>
        </div>

        {/* Institution / Target Cohort Pill */}
        <div className="mb-6 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
            <div className="truncate">
              <p className="text-[11px] font-semibold text-[#0F172A] truncate">
                {candidate.targetRole}
              </p>
              <p className="text-[10px] text-[#64748B] truncate">
                {candidate.batchYear} • Placement Cohort
              </p>
            </div>
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-[#F1F5F9] text-[#2563EB] font-semibold'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#2563EB]' : 'text-[#64748B]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#2563EB]'
                        : item.badge === 'Live'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Public Landing Page link */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => onSelectTab('landing')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
              currentTab === 'landing'
                ? 'bg-[#F1F5F9] text-[#2563EB] font-semibold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-[#F8FAFC]'
            }`}
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Public Landing Page</span>
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Bottom Candidate Profile Widget - Editorial Style */}
      <div className="pt-6 border-t border-[#E2E8F0]">
        <div
          onClick={() => onSelectTab('settings')}
          className="flex items-center gap-3 cursor-pointer p-1.5 -m-1.5 rounded-lg hover:bg-slate-50 transition"
        >
          <div className="w-8 h-8 rounded-full bg-[#E2E8F0] flex items-center justify-center font-bold text-xs text-[#0F172A] shrink-0">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F172A] truncate">
              {candidate.name}
            </p>
            <p className="text-xs text-[#64748B] truncate">
              Standard Plan • {candidate.batchYear}
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center text-[10px] font-bold text-[#10B981] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
              {candidate.readinessScore}%
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-slate-400" />
            Verified Placement Bar
          </span>
          <span className="font-mono">v2.4</span>
        </div>
      </div>
    </aside>
  );
};
