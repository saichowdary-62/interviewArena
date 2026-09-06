import React, { useState, useEffect } from 'react';
import {
  NavigationTab,
  CandidateProfile,
  EvaluationReport,
  ResumeAnalysisData,
} from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { InterviewView } from './components/InterviewView';
import { ResumeAnalysisView } from './components/ResumeAnalysisView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import {
  AuthUser,
  DEFAULT_PROFILE,
  DEFAULT_REPORT,
  getCurrentUser,
  getCandidateProfile,
  getEvaluationReport,
  getActiveResume,
  saveCandidateProfile,
  signOutUser,
} from './lib/database';
import { supabase } from './lib/supabase';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [candidate, setCandidate] = useState<CandidateProfile>(DEFAULT_PROFILE);
  const [report, setReport] = useState<EvaluationReport>(DEFAULT_REPORT);
  const [activeResume, setActiveResume] = useState<ResumeAnalysisData | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  // Initialize data from persistent database/storage on load
  useEffect(() => {
    async function loadSessionAndData() {
      setIsSessionLoading(true);
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          const profile = await getCandidateProfile();
          if (profile) {
            setCandidate(profile);
          }
          const rep = await getEvaluationReport();
          if (rep) {
            setReport(rep);
          }
          const res = await getActiveResume();
          if (res) {
            setActiveResume(res);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Session verification warning:', err);
        setCurrentUser(null);
      } finally {
        setIsSessionLoading(false);
      }
    }
    loadSessionAndData();

    // Set up Supabase auth listener for real-time session updates
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const u = session.user;
          const authUser: AuthUser = {
            id: u.id,
            email: u.email || '',
            name: u.user_metadata?.name || u.email?.split('@')[0] || 'Candidate',
          };
          setCurrentUser(authUser);
          setIsSessionLoading(false);
          const profile = await getCandidateProfile();
          setCandidate(profile);
          const rep = await getEvaluationReport();
          setReport(rep);
          const res = await getActiveResume();
          if (res) {
            setActiveResume(res);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setCandidate(DEFAULT_PROFILE);
          setReport(DEFAULT_REPORT);
          setActiveResume(null);
          setIsSessionLoading(false);
        }
      });

      return () => {
        authListener.subscription?.unsubscribe();
      };
    } else {
      setIsSessionLoading(false);
    }
  }, []);

  const handleStartInterview = () => {
    setCurrentTab('interviews');
  };

  const handleFinishInterview = (newReport?: EvaluationReport) => {
    if (newReport) {
      setReport(newReport);
      // Dynamically calculate and update candidate readiness score
      const updatedProfile: CandidateProfile = {
        ...candidate,
        interviewsCompleted: candidate.interviewsCompleted + 1,
        readinessScore: newReport.overallScore,
        avgPerformance: Number(
          (
            (candidate.avgPerformance * candidate.interviewsCompleted + newReport.overallScore) /
            (candidate.interviewsCompleted + 1)
          ).toFixed(1)
        ),
      };
      setCandidate(updatedProfile);
      saveCandidateProfile(updatedProfile);
    } else {
      setCandidate((prev) => ({
        ...prev,
        interviewsCompleted: prev.interviewsCompleted + 1,
        readinessScore: Math.min(98, prev.readinessScore + 2),
      }));
    }
    setCurrentTab('reports');
  };

  const handleAuthSuccess = async (user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    setCurrentTab('dashboard');
    const profile = await getCandidateProfile();
    setCandidate(profile);
    const rep = await getEvaluationReport();
    setReport(rep);
    const res = await getActiveResume();
    if (res) {
      setActiveResume(res);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCandidate(DEFAULT_PROFILE);
    setReport(DEFAULT_REPORT);
    setActiveResume(null);
    setCurrentTab('dashboard');
  };

  // 1. Session verification screen: Neat, minimal, and clean page loader
  if (isSessionLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-8 h-8">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#2563EB] animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-[#0F172A] tracking-tight">Interview Arena</p>
            <p className="text-[11px] text-[#94A3B8]">Loading workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Route Protection: Dashboard, Interviews, Resume, Reports, and Settings require authentication
  if (!currentUser) {
    return (
      <>
        <LandingPage
          onStartInterview={() => {
            setAuthModalMode('signup');
            setIsAuthModalOpen(true);
          }}
          onSignIn={() => {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
          }}
          onSignUp={() => {
            setAuthModalMode('signup');
            setIsAuthModalOpen(true);
          }}
          candidate={candidate}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  // 3. Authenticated user explicitly viewing the public Landing Page
  if (currentTab === 'landing') {
    return (
      <LandingPage
        onStartInterview={() => setCurrentTab('interviews')}
        onSignIn={() => setCurrentTab('dashboard')}
        onSignUp={() => setCurrentTab('dashboard')}
        candidate={candidate}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A]">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        candidate={candidate}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onStartInterview={handleStartInterview}
          onSelectTab={(tab) => setCurrentTab(tab)}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
        />

        {/* Dynamic Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              candidate={candidate}
              evaluationReport={report}
              onStartInterview={handleStartInterview}
              onGoToResume={() => setCurrentTab('resume')}
              onGoToReports={() => setCurrentTab('reports')}
              activeResume={activeResume}
            />
          )}

          {currentTab === 'interviews' && (
            <InterviewView
              candidateName={candidate.name}
              onFinishInterview={handleFinishInterview}
              candidateProfile={candidate}
              activeResume={activeResume}
            />
          )}

          {currentTab === 'resume' && (
            <ResumeAnalysisView
              activeResume={activeResume}
              targetRole={candidate.targetRole}
              onUpdateResume={(updated) => {
                setActiveResume(updated);
                setCandidate((prev) => ({
                  ...prev,
                  readinessScore: Math.round((prev.readinessScore + updated.roleMatchPercentage) / 2),
                }));
              }}
              onStartInterviewWithTopic={(_topic) => {
                handleStartInterview();
              }}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              report={report}
              onRetakeInterview={handleStartInterview}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              candidate={candidate}
              onUpdateCandidate={(updated) => setCandidate(updated)}
            />
          )}
        </main>
      </div>

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
