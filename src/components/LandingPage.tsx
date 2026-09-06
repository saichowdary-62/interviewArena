import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Video,
  FileText,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Award,
  Layers,
  Clock,
  Building2,
  Users,
} from 'lucide-react';
import { CandidateProfile } from '../types';

interface LandingPageProps {
  onStartInterview: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  candidate: CandidateProfile;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartInterview,
  onSignIn,
  onSignUp,
  candidate,
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-blue-100 selection:text-blue-700">
      {/* Public Top Navbar */}
      <nav className="border-b border-[#E2E8F0] bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0F172A] text-xl tracking-tight">
              Interview Arena
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#64748B]">
            <a href="#features" className="hover:text-[#0F172A] transition">
              Methodology
            </a>
            <a href="#benchmark" className="hover:text-[#0F172A] transition">
              Placement Benchmarks
            </a>
            <a href="#institutions" className="hover:text-[#0F172A] transition">
              For Placement Cells
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="text-xs font-semibold text-[#0F172A] px-3.5 py-2 rounded-lg hover:bg-slate-100 transition border border-[#E2E8F0]"
            >
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 px-4 py-2 rounded-lg shadow-xs transition"
            >
              Create Account
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
          <span>2026 Campus Placement & Engineering Readiness Benchmark</span>
        </div>

        {/* Mandatory Exact Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0F172A] tracking-tight max-w-4xl mx-auto leading-[1.15]">
          Ace Every Interview Before It Happens
        </h1>

        {/* Mandatory Exact Subheading */}
        <p className="mt-6 text-lg sm:text-xl text-[#64748B] max-w-2xl mx-auto leading-relaxed font-normal">
          Practice with realistic mock interviews, analyze your strengths, and
          improve your placement readiness.
        </p>

        {/* Action CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onSignUp}
            className="flex items-center gap-2 px-6 py-3.5 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition active:scale-98"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onSignIn}
            className="flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 text-[#0F172A] text-sm font-semibold rounded-lg border border-[#E2E8F0] shadow-2xs transition"
          >
            <span>Sign In to Arena</span>
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
            No setup required
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
            Real recruiter benchmarks
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
            Instant multi-metric report
          </span>
        </div>

        {/* Hero Visual: Premium Analytics Dashboard Preview (NOT an AI Chatbot) */}
        <div className="mt-14 max-w-5xl mx-auto text-left">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
            {/* Top SaaS Window Chrome */}
            <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="ml-3 text-xs font-mono text-slate-500">
                  interview-arena.app/evaluations/candidate-report
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                  Placement Readiness: 86 / 100
                </span>
              </div>
            </div>

            {/* Dashboard Preview Inner Grid */}
            <div className="p-6 md:p-8 bg-[#FAFAFC] space-y-6">
              {/* Candidate Quick Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-[#E2E8F0] gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-[#0F172A]">
                      Candidate Readiness Telemetry
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold border border-blue-100">
                      SDE-1 Systems Track
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Evaluated against Tier-1 Product Companies (Stripe, Google, Amazon, Fintech)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-right">
                    <p className="text-[10px] uppercase font-semibold text-[#64748B]">
                      Cohort Percentile
                    </p>
                    <p className="text-sm font-bold text-[#0F172A]">
                      Top 8% (92nd Percentile)
                    </p>
                  </div>
                  <button
                    onClick={onSignIn}
                    className="px-3.5 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
                  >
                    Sign In to View Your Telemetry
                  </button>
                </div>
              </div>

              {/* 4 Realistic Metrics Preview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    Placement Readiness
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-[#0F172A]">86%</span>
                    <span className="text-xs font-semibold text-[#10B981] flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +6%
                    </span>
                  </div>
                  <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-[86%] h-full bg-[#2563EB]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    Technical Knowledge
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-[#0F172A]">88%</span>
                    <span className="text-xs font-semibold text-slate-500">Benchmark: 74%</span>
                  </div>
                  <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-[88%] h-full bg-[#10B981]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    Problem Solving
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-[#0F172A]">90%</span>
                    <span className="text-xs font-semibold text-emerald-600">Top Quartile</span>
                  </div>
                  <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-[90%] h-full bg-[#2563EB]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    Mock Runs Completed
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-[#0F172A]">12</span>
                    <span className="text-xs text-slate-500">Avg 42 min/run</span>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500">
                    5 Systems • 4 DS&A • 3 Behavioral
                  </p>
                </div>
              </div>

              {/* Lower split view: Radar Competency Preview & Skill Heatmap preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                      Evaluation Dimensions
                    </h4>
                    <span className="text-[11px] text-[#64748B]">Sai Amarnadh vs Benchmark</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[#0F172A]">Technical Architecture</span>
                        <span className="font-semibold text-blue-600">88%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: '88%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[#0F172A]">Algorithmic Concurrency</span>
                        <span className="font-semibold text-blue-600">90%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: '90%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[#0F172A]">STAR Behavioral Delivery</span>
                        <span className="font-semibold text-blue-600">84%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: '84%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                      Live Competency Heatmap
                    </h4>
                    <span className="text-[11px] text-[#64748B]">12 Verified Skills</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                      <p className="text-[11px] font-semibold text-emerald-900">Distributed Caching</p>
                      <p className="text-[10px] text-emerald-700">90% • Mastered</p>
                    </div>
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                      <p className="text-[11px] font-semibold text-emerald-900">API Idempotency</p>
                      <p className="text-[10px] text-emerald-700">88% • Mastered</p>
                    </div>
                    <div className="p-2 rounded bg-blue-50 border border-blue-100">
                      <p className="text-[11px] font-semibold text-blue-900">SQL Indexing</p>
                      <p className="text-[10px] text-blue-700">86% • Proficient</p>
                    </div>
                    <div className="p-2 rounded bg-amber-50 border border-amber-100">
                      <p className="text-[11px] font-semibold text-amber-900">DB Sharding</p>
                      <p className="text-[10px] text-amber-700">68% • Needs Focus</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Benchmarks Bar */}
      <section id="benchmark" className="border-y border-[#E2E8F0] bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-6">
            Benchmarked against hiring bars at premier technology companies
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 items-center justify-center opacity-70">
            <div className="text-center font-bold text-slate-700 text-sm tracking-tight">
              STRIPE
            </div>
            <div className="text-center font-bold text-slate-700 text-sm tracking-tight">
              GOOGLE
            </div>
            <div className="text-center font-bold text-slate-700 text-sm tracking-tight">
              AMAZON
            </div>
            <div className="text-center font-bold text-slate-700 text-sm tracking-tight">
              MICROSOFT
            </div>
            <div className="text-center font-bold text-slate-700 text-sm tracking-tight">
              GOLDMAN SACHS
            </div>
            <div className="text-center font-bold text-slate-700 text-sm tracking-tight">
              UBER
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Product Pillars */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight">
            Engineered for Placement Excellence
          </h2>
          <p className="text-sm text-[#64748B] mt-3">
            Built to bridge the gap between textbook coding practice and real-world high-stakes technical interviews.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-2xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">
              Realistic Split-Screen Arena
            </h3>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              Experience the pressure of real video interviews. Dual view with interviewer panel, live camera framing, and real-time audio waveform recording.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-2xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">
              Resume Gap Analysis
            </h3>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              Upload your resume to extract validated skills, identify high-impact talking points, and pinpoint missing requirements before recruiters see them.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-2xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">
              Actionable Placement Reports
            </h3>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              Comprehensive 5-dimension scorecard: Technical Knowledge, Communication, Problem Solving, Confidence, and Leadership with a 4-week roadmap.
            </p>
          </div>
        </div>
      </section>

      {/* College & Placement Cell Section */}
      <section id="institutions" className="bg-[#FAFAFC] border-t border-[#E2E8F0] py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
            For Colleges & Placement Cells
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2 tracking-tight">
            Empower Your Entire Batch with Placement Readiness
          </h2>
          <p className="text-sm text-[#64748B] mt-3 max-w-2xl mx-auto">
            Interview Arena provides placement officers with cohort analytics, benchmark distribution, and targeted intervention data to maximize offer conversions.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={onSignUp}
              className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              Create Placement Account
            </button>
            <button
              onClick={onSignIn}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-semibold rounded-lg border border-[#E2E8F0] transition"
            >
              Sign In to Arena
            </button>
          </div>
        </div>
      </section>

      {/* Clean SaaS Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-8 px-6 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0F172A]">Interview Arena</span>
            <span>• Placement Readiness System</span>
          </div>
          <p className="text-slate-400">
            Engineered for ambitious candidates and top university placement cells.
          </p>
        </div>
      </footer>
    </div>
  );
};
