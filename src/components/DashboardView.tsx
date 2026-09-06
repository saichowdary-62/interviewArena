import React from 'react';
import { Video, FileText, ArrowRight, Activity, Zap } from 'lucide-react';
import { CandidateProfile, EvaluationReport, ResumeAnalysisData } from '../types';

interface DashboardViewProps {
  candidate: CandidateProfile;
  evaluationReport: EvaluationReport;
  onStartInterview: () => void;
  onGoToResume: () => void;
  onGoToReports: () => void;
  activeResume?: ResumeAnalysisData | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  candidate,
  evaluationReport,
  onStartInterview,
  onGoToResume,
  onGoToReports,
  activeResume,
}) => {
  const hasInterviews = candidate.interviewsCompleted > 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-2">
            {candidate.name ? `Welcome, ${candidate.name.split(' ')[0]}.` : 'Placement Arena.'}
          </h1>
          <p className="text-lg text-slate-500 max-w-xl">
            Refine your technical communication and interview skills with AI-guided mock sessions.
          </p>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Interview Action Card */}
        <div className="group bg-slate-900 rounded-3xl p-8 md:p-10 text-white flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-900/20">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
              <Video className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Mock Interview</h2>
            <p className="text-slate-400 mb-8 max-w-sm">
              Start a dynamic, AI-powered mock interview tailored to your target role and resume context.
            </p>
          </div>
          
          <button
            onClick={onStartInterview}
            className="relative z-10 self-start bg-white text-slate-900 hover:bg-slate-100 px-6 py-3 rounded-full font-semibold text-sm transition-all flex items-center gap-2 group-hover:px-8"
          >
            Start Session
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Resume Action Card */}
        <div className="group bg-white rounded-3xl p-8 md:p-10 border border-slate-200 flex flex-col justify-between transition-all hover:shadow-xl hover:border-slate-300">
          <div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Resume Context</h2>
            <p className="text-slate-500 mb-8 max-w-sm">
              {activeResume
                ? 'Your resume is uploaded and actively driving your personalized interview questions.'
                : 'Upload your resume to ground the interview in your real-world experience and skills.'}
            </p>
          </div>
          
          <button
            onClick={onGoToResume}
            className="self-start bg-blue-50 hover:bg-blue-100 text-blue-700 px-6 py-3 rounded-full font-semibold text-sm transition-all flex items-center gap-2"
          >
            {activeResume ? 'Manage Resume' : 'Upload Resume'}
          </button>
        </div>
      </div>

    </div>
  );
};
