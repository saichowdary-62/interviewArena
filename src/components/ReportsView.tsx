import React from 'react';
import { Award, BookOpen, Clock, Target, ArrowRight, Video, FileText } from 'lucide-react';
import { EvaluationReport, ParameterEvaluation } from '../types';

interface ReportsViewProps {
  report: EvaluationReport;
  onRetakeInterview: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  report,
  onRetakeInterview,
}) => {
  const hasCompletedInterview =
    report &&
    report.evaluationDate !== 'Not started' &&
    report.evaluationDate !== 'Pending Initial Evaluation';

  if (!hasCompletedInterview) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <FileText className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">No Evaluation Yet</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          Complete your first mock interview to receive a personalized, AI-driven performance breakdown.
        </p>
        <button
          onClick={onRetakeInterview}
          className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-3 rounded-full font-semibold transition-all"
        >
          Take an Interview
        </button>
      </div>
    );
  }

  const parameters = report.evaluationParameters || {
    technicalAccuracy: { score: 0, justification: '', highlights: [], mistakes: [], idealComparison: '' },
    communicationClarity: { score: 0, justification: '', highlights: [], mistakes: [], idealComparison: '' },
    problemSolvingStructure: { score: 0, justification: '', highlights: [], mistakes: [], idealComparison: '' },
    depthOfKnowledge: { score: 0, justification: '', highlights: [], mistakes: [], idealComparison: '' },
    confidenceAndDelivery: { score: 0, justification: '', highlights: [], mistakes: [], idealComparison: '' },
  };

  const scoreColor = report.overallScore >= 80 ? 'text-emerald-600' : report.overallScore >= 60 ? 'text-blue-600' : 'text-amber-600';
  const bgScoreColor = report.overallScore >= 80 ? 'bg-emerald-50' : report.overallScore >= 60 ? 'bg-blue-50' : 'bg-amber-50';

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-200">
        <div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
            Evaluation Complete
          </p>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Interview Report</h1>
          <p className="text-slate-500">{report.evaluationDate}</p>
        </div>
        
        <div className={`px-8 py-6 rounded-3xl ${bgScoreColor} flex flex-col items-center border border-white/20 shadow-sm`}>
          <span className="text-sm font-semibold text-slate-600 mb-1">Overall Score</span>
          <span className={`text-5xl font-black tracking-tighter ${scoreColor}`}>
            {report.overallScore}
          </span>
          <span className="text-sm font-semibold text-slate-500 mt-1">/ 100</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Performance Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {Object.entries(parameters).map(([key, param]) => {
            const typedParam = param as ParameterEvaluation;
            return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-semibold text-slate-900 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <span className="font-bold text-slate-700">{typedParam.score}/100</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-900 rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.max(0, typedParam.score)}%` }} 
                />
              </div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {typedParam.justification}
              </p>
            </div>
            );
          })}
        </div>
      </div>

      {report.questionEvaluations && report.questionEvaluations.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-5">
          <h2 className="text-2xl font-bold text-slate-900">Question-by-Question Results</h2>
          {report.questionEvaluations.map((evaluation, index) => (
            <article key={index} className="border-t border-slate-100 pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">Question {index + 1}</h3>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                  {evaluation.overallQuestionScore}/100
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <strong className="text-xs uppercase tracking-wider text-slate-700">Candidate Answer</strong>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {evaluation.candidateAnswer || evaluation.candidateNotes || 'No answer provided'}
                </p>
              </div>
              <p className="text-sm text-slate-700">{evaluation.recruiterVerdict}</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <span className="rounded-lg bg-slate-50 p-2">Relevance: {evaluation.relevance}%</span>
                <span className="rounded-lg bg-slate-50 p-2">Accuracy: {evaluation.technicalAccuracyScore}%</span>
                <span className="rounded-lg bg-slate-50 p-2">Completeness: {evaluation.completeness}%</span>
                <span className="rounded-lg bg-slate-50 p-2">Clarity: {evaluation.clarity}%</span>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <strong className="text-emerald-700">Strengths</strong>
                  <ul className="mt-1 list-disc pl-5 text-slate-600">
                    {(evaluation.whatWasCorrect.length > 0 ? evaluation.whatWasCorrect : ['No demonstrated strengths']).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <strong className="text-amber-700">Weaknesses and gaps</strong>
                  <ul className="mt-1 list-disc pl-5 text-slate-600">
                    {(evaluation.whatWasMissing.length > 0 ? evaluation.whatWasMissing : ['No missing elements recorded']).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                  </ul>
                </div>
              </div>
              <p className="text-sm text-slate-600">{evaluation.technicalFeedback}</p>
              <p className="text-sm text-slate-600">{evaluation.communicationFeedback}</p>
            </article>
          ))}
        </div>
      )}

      {report.verdict && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <span className="text-slate-400 font-semibold text-sm uppercase tracking-wider block mb-1">Final Verdict</span>
            <span className="text-2xl font-bold">{report.verdict}</span>
          </div>
          <button 
            onClick={onRetakeInterview}
            className="bg-white text-slate-900 hover:bg-slate-100 px-6 py-3 rounded-full font-semibold transition-colors shrink-0"
          >
            Retake Interview
          </button>
        </div>
      )}
    </div>
  );
};
