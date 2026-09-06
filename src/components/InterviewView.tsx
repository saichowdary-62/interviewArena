import React, { useState, useEffect } from 'react';
import {
  Mic,
  Square,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Clock,
  MessageSquare,
  Award,
  RefreshCw,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Check,
  Target,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Info,
  ListChecks,
} from 'lucide-react';
import {
  InterviewQuestion,
  CandidateProfile,
  ResumeAnalysisData,
  EvaluationReport,
} from '../types';
import { WebcamPreview } from './WebcamPreview';
import { AudioWaveform } from './AudioWaveform';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useVocalTelemetry } from '../hooks/useVocalTelemetry';
import { saveInterviewSessionRecord, saveCandidateProfile } from '../lib/database';
import { VideoInterviewAnalyzer } from '../lib/videoInterviewAnalyzer';
import {
  resilientGenerateQuestions,
  resilientEvaluateAnswer,
  resilientCompleteEvaluation,
} from '../lib/productionAiBridge';

interface InterviewViewProps {
  candidateName: string;
  onFinishInterview: (report?: EvaluationReport) => void;
  candidateProfile?: CandidateProfile;
  activeResume?: ResumeAnalysisData | null;
  onNavigateToResume?: () => void;
}

export const InterviewView: React.FC<InterviewViewProps> = ({
  candidateName,
  onFinishInterview,
  candidateProfile,
  activeResume,
  onNavigateToResume,
}) => {
  const [isConfiguring, setIsConfiguring] = useState<boolean>(true);
  const [interviewMode, setInterviewMode] = useState<'auto' | 'custom'>('auto');
  const [questionCount, setQuestionCount] = useState<number>(6);
  const [jobRole, setJobRole] = useState<string>(
    activeResume?.targetRole || candidateProfile?.targetRole || 'Software Development Engineer'
  );
  const [jobDescription, setJobDescription] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [customQuestions, setCustomQuestions] = useState<string>('');

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showContext, setShowContext] = useState<boolean>(false);
  const [, setAudioLevel] = useState<number>(0);

  // Candidate verbal transcripts & written notes (live, candidate-provided)
  const [candidateNotes, setCandidateNotes] = useState<Record<number, string>>({});
  const [verbalAnswers, setVerbalAnswers] = useState<Record<number, string>>({});

  // Realtime Vocal Telemetry (WPM, audio level, VAD, filler tracking, framing metrics)
  const currentAnswerText = verbalAnswers[currentQuestionIndex] || '';
  const {
    telemetry,
    audioLevel: vocalAudioLevel,
    isSpeaking,
    hasMicPermission,
    micError,
    requestMicPermission,
    updateEyeContact,
    analyserNode,
  } = useVocalTelemetry({
    isRecording,
    transcript: currentAnswerText,
  });

  // Full-session Video Interview Analyzer engine instance
  const videoAnalyzerRef = React.useRef<VideoInterviewAnalyzer>(new VideoInterviewAnalyzer());

  // Synchronize audio speaking status with video analyzer for audio-visual alignment
  useEffect(() => {
    videoAnalyzerRef.current.updateAudioContext(isSpeaking, vocalAudioLevel);
  }, [isSpeaking, vocalAudioLevel]);

  // AI Follow-ups and evaluations
  const [followUpQuestions, setFollowUpQuestions] = useState<Record<number, any>>({});
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState<boolean>(false);
  const [questionEvaluations, setQuestionEvaluations] = useState<Record<number, any>>({});
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState<boolean>(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState<boolean>(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Speech recognition hook
  const {
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported,
  } = useSpeechRecognition();

  // Trigger question generation strictly from the candidate's resume
  const generateQuestionsFromResume = async () => {
    if (!activeResume || activeResume.skillsExtracted.length === 0) {
      return;
    }

    setIsGeneratingQuestions(true);
    setLoadError(null);

    try {
      // Build rich resume text combining full extracted text or factual resume entities
      const synthesizedProjects = activeResume.verifiedFacts?.projectsFound?.length
        ? activeResume.verifiedFacts.projectsFound
            .map((p) => `Project: ${p.projectName}\nTechnologies: ${(p.technologies || []).join(', ')}\nDetails: ${p.exactResumeText}\nMetrics: ${p.metrics || 'Production reliability'}`)
            .join('\n\n')
        : activeResume.projectsIdentified?.length
        ? activeResume.projectsIdentified
            .map((p) => `Project: ${p.name}\nRole: ${p.role}\nTechnologies: ${(p.tech || []).join(', ')}\nMetrics: ${p.metrics}\nDetails: ${(p.talkingPoints || []).join('; ')}`)
            .join('\n\n')
        : '';

      const synthesizedSkills = activeResume.verifiedFacts?.skillsFound?.length
        ? activeResume.verifiedFacts.skillsFound.map((s) => `Skill: ${s.skill} (${s.sectionFound || 'Technical'}, excerpt: "${s.exactResumeText}")`).join('\n')
        : activeResume.skillsExtracted?.length
        ? activeResume.skillsExtracted.map((c) => `${c.category}: ${c.skills.map((s) => s.name).join(', ')}`).join('\n')
        : '';

      const synthesizedExperience = activeResume.verifiedFacts?.experienceFound?.length
        ? activeResume.verifiedFacts.experienceFound.map((e) => `Experience: ${e.role} at ${e.organization} (${e.duration || 'Documented'}). Quote: "${e.exactResumeText}"`).join('\n')
        : '';

      const synthesizedFacts = [synthesizedProjects, synthesizedSkills, synthesizedExperience].filter(Boolean).join('\n\n---\n\n');

      const fullResumeText =
        activeResume.extractedText ||
        activeResume.rawText ||
        (synthesizedFacts && synthesizedFacts.length > 50 ? synthesizedFacts : null) ||
        activeResume.rawTextSnippet ||
        JSON.stringify(activeResume);

      const result = await resilientGenerateQuestions({
        roleTrack: jobRole,
        companyBenchmark:
          candidateProfile?.targetCompanyTrack ||
          'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
        resumeText: fullResumeText,
        parsedResume: activeResume,
        jobDescription: interviewMode === 'auto' ? jobDescription : undefined,
        difficulty,
        customQuestions: interviewMode === 'custom' ? customQuestions : undefined,
        questionCount,
        recentQuestionTexts: (() => {
          try {
            return JSON.parse(localStorage.getItem('arena_recent_question_texts') || '[]');
          } catch {
            return [];
          }
        })(),
      });

      if (result.questions && result.questions.length > 0) {
        setQuestions(result.questions);
        try {
          const previousQuestions = JSON.parse(localStorage.getItem('arena_recent_question_texts') || '[]');
          localStorage.setItem(
            'arena_recent_question_texts',
            JSON.stringify([...previousQuestions, ...result.questions.map((question) => question.questionText)].slice(-36))
          );
        } catch {
          // Ignore unavailable browser storage; generation remains functional.
        }
        setCurrentQuestionIndex(0);
      } else {
        throw new Error('No questions returned from question generator.');
      }
    } catch (err: any) {
      console.warn('Error generating questions from resume:', err);
      setLoadError(err?.message || 'Failed to load personalized interview questions.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Load questions when activeResume is available and questions are empty
  // Automatically trigger if we have resume but no configuration step
  useEffect(() => {
    // We now have a configuration step, so we don't auto-start.
    // The user will click "Start Interview" to begin.
  }, [activeResume]);

  // Sync speech transcript into verbal answer in real time
  useEffect(() => {
    if (transcript) {
      setVerbalAnswers((prev) => ({
        ...prev,
        [currentQuestionIndex]: (prev[currentQuestionIndex] ? prev[currentQuestionIndex] + ' ' : '') + transcript,
      }));
      resetTranscript();
    }
  }, [transcript, currentQuestionIndex, resetTranscript]);

  // Timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  // Toggle voice recording
  const toggleRecording = async () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
    } else {
      await requestMicPermission();
      startListening();
      setIsRecording(true);
    }
  };

  const currentQuestion: InterviewQuestion | undefined = questions[currentQuestionIndex];

  // Dynamic Follow-Up Generator
  const handleGenerateFollowUp = async () => {
    if (!currentQuestion) return;
    const answer = verbalAnswers[currentQuestionIndex] || candidateNotes[currentQuestionIndex] || '';
    if (!answer.trim()) {
      alert('Please speak or type a response first so the interviewer can ask a relevant follow-up probe.');
      return;
    }

    setIsGeneratingFollowUp(true);
    try {
      const response = await fetch('/api/interview/generate-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousQuestion: currentQuestion,
          candidateAnswer: answer,
          interviewContext: `Target: ${candidateProfile?.targetRole || 'SDE-1'} at ${candidateProfile?.targetCompanyTrack || 'Tier-1'}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.followUp) {
          setFollowUpQuestions((prev) => ({
            ...prev,
            [currentQuestionIndex]: data.followUp,
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to generate follow up:', err);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  // Evaluate single question answer
  const handleEvaluateAnswer = async () => {
    if (!currentQuestion) return;
    const answer = verbalAnswers[currentQuestionIndex] || '';
    const notes = candidateNotes[currentQuestionIndex] || '';

    setIsEvaluatingAnswer(true);
    try {
      const res = await resilientEvaluateAnswer({
        question: currentQuestion,
        candidateAnswer: answer,
        candidateNotes: notes,
        elapsedSeconds,
      });

      if (res.evaluation) {
        setQuestionEvaluations((prev) => ({
          ...prev,
          [currentQuestionIndex]: res.evaluation,
        }));
      }
    } catch (err) {
      console.warn('Failed to evaluate answer:', err);
    } finally {
      setIsEvaluatingAnswer(false);
    }
  };

  // Complete interview & generate 5-dimension report
  const handleCompleteInterview = async () => {
    setIsSubmittingFinal(true);
    if (isRecording) {
      stopListening();
      setIsRecording(false);
    }

    try {
      const videoReport = videoAnalyzerRef.current.generateSessionReport();

      const res = await resilientCompleteEvaluation({
        sessionQuestions: questions,
        answers: verbalAnswers,
        notes: candidateNotes,
        elapsedSeconds,
        candidateProfile: candidateProfile || {
          name: candidateName,
          targetRole: activeResume?.targetRole || 'Software Development Engineer (SDE-1)',
          targetCompanyTrack: 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
        },
        videoAnalysis: videoReport,
      });

      const finalReport = res.report;

      if (finalReport) {
        if (!finalReport.videoAnalysis) {
          finalReport.videoAnalysis = videoReport;
        }
        const profileToSave: CandidateProfile = {
          ...(candidateProfile || {
            name: candidateName,
            email: '',
            targetRole: activeResume?.targetRole || 'Software Development Engineer (SDE-1)',
            targetCompanyTrack: 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
            institution: 'National Institute of Technology',
            batchYear: 'Batch 2026',
            readinessScore: 0,
            readinessDelta: 0,
            interviewsCompleted: 0,
            avgPerformance: 0,
            improvementAreasCount: 0,
          }),
          readinessScore: finalReport.overallScore,
          interviewsCompleted: (candidateProfile?.interviewsCompleted || 0) + 1,
          avgPerformance: finalReport.overallScore,
        };

        await saveCandidateProfile(profileToSave);
        await saveInterviewSessionRecord(
          finalReport,
          questions,
          verbalAnswers,
          candidateNotes,
          elapsedSeconds,
          profileToSave
        );
      }

      onFinishInterview(finalReport);
    } catch (err) {
      console.warn('Error completing interview session:', err);
      onFinishInterview();
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  const handleNext = () => {
    setShowHint(false);
    setShowContext(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setShowHint(false);
    setShowContext(false);
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Case 1: No Resume Uploaded Yet
  if (!activeResume || activeResume.skillsExtracted.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xs text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Resume Required for Mock Interview
            </h2>
            <p className="text-xs text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
              Interview Arena generates interview rounds grounded in your real projects, verified tools, and stated metrics. Questions follow a structured 6-stage flow (Verification, Project Deep Dive, Technical, Problem Solving, Behavioral, Evaluation).
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToResume}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Upload Resume to Begin</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 1.5: Configuration
  if (isConfiguring) {
    return (
      <div className="max-w-5xl mx-auto py-10 px-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configure Your Interview</h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Select how you want to generate your interview. We will always use your resume to personalize the context.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Mode & Content Inputs */}
          <div className="lg:col-span-7 space-y-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setInterviewMode('auto')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  interviewMode === 'auto'
                    ? 'bg-white shadow-sm border border-slate-200/50 text-blue-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Target className="w-4 h-4" />
                AI Tailored
              </button>
              <button
                onClick={() => setInterviewMode('custom')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  interviewMode === 'custom'
                    ? 'bg-white shadow-sm border border-slate-200/50 text-purple-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Custom Practice
              </button>
            </div>

            <div className="space-y-6">
              {interviewMode === 'auto' ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">
                      Target Job Role
                    </label>
                    <input
                      type="text"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center justify-between">
                      <span>Job Description</span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      rows={6}
                      className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-none transition-all shadow-sm"
                      placeholder="Paste the job description here so we can tailor the questions..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">
                      Custom Questions
                    </label>
                    <textarea
                      value={customQuestions}
                      onChange={(e) => setCustomQuestions(e.target.value)}
                      rows={9}
                      className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none resize-none transition-all shadow-sm"
                      placeholder="Enter one exact question per line. Questions will be used in this order."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Settings & Actions */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6 flex-grow">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Session Settings</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">
                    <Target className="w-4 h-4 text-slate-400" /> Interview Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white transition-all shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="Easy">Easy (Junior / Entry-Level)</option>
                    <option value="Medium">Medium (Mid-Level)</option>
                    <option value="Hard">Hard (Senior)</option>
                    <option value="Staff/Principal">Staff/Principal (Expert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-slate-400" /> Number of Questions
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                    className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white transition-all shadow-sm appearance-none cursor-pointer"
                  >
                    <option value={3}>3 Questions (Quick Practice)</option>
                    <option value={4}>4 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={6}>6 Questions (Full Interview)</option>
                    <option value={8}>8 Questions (Extended)</option>
                    <option value={10}>10 Questions (Marathon)</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 mt-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfiguring(false);
                    generateQuestionsFromResume();
                  }}
                  disabled={interviewMode === 'custom' && customQuestions.trim().length === 0}
                  className={`w-full py-4 text-white text-base font-bold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                    interviewMode === 'auto'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 hover:shadow-blue-600/40'
                      : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20 hover:shadow-purple-600/40'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FileText className="w-5 h-5" />
                  Start {interviewMode === 'auto' ? 'Tailored' : 'Custom'} Interview
                </button>
              </div>
            </div>

            {/* Informational Design Element */}
            <div className={`p-6 rounded-3xl border flex items-start gap-4 transition-colors duration-300 ${
              interviewMode === 'auto' 
                ? 'bg-blue-50/50 border-blue-100 text-blue-900' 
                : 'bg-purple-50/50 border-purple-100 text-purple-900'
            }`}>
              <Info className={`w-5 h-5 mt-0.5 shrink-0 ${interviewMode === 'auto' ? 'text-blue-500' : 'text-purple-500'}`} />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Resume Grounding Active</h4>
                <p className={`text-xs leading-relaxed ${interviewMode === 'auto' ? 'text-blue-700' : 'text-purple-700'}`}>
                  Your mock interview will automatically adapt its context and follow-up questions using the verified skills and projects found in your parsed resume data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Generating questions
  if (isGeneratingQuestions) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-bold text-slate-900">
            Generating 6-Stage Personalized Interview
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Grounded in {activeResume.filename} • Calibrating project deep-dives for {activeResume.targetRole}
          </p>
        </div>
      </div>
    );
  }

  // Case 3: Error generating questions
  if (loadError || !currentQuestion) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Could Not Generate Interview</h3>
            <p className="text-xs text-rose-700 mt-1">{loadError || 'Unable to prepare questions.'}</p>
          </div>
          <button
            type="button"
            onClick={generateQuestionsFromResume}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
          >
            Retry Generation
          </button>
        </div>
      </div>
    );
  }

  const activeFollowUp = followUpQuestions[currentQuestionIndex];
  const activeEval = questionEvaluations[currentQuestionIndex];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#F8FAFC]">
      {/* Top Header & 6-Stage Stepper */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900">
                Live Technical Assessment
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {currentQuestion.stageName || `Stage ${currentQuestionIndex + 1} of 6`}
              </span>
            </div>
            {currentQuestion.resumeAnchor && (
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <Target className="w-3 h-3 text-blue-600" />
                <span>Resume Anchor: {currentQuestion.resumeAnchor}</span>
              </p>
            )}
          </div>
        </div>

        {/* 6-Stage Selector Buttons */}
        <div className="hidden md:flex items-center gap-1.5">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentQuestionIndex;
            const isCompleted = idx < currentQuestionIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setShowHint(false);
                  setShowContext(false);
                  setCurrentQuestionIndex(idx);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={q.stageName}
              >
                <span>Stage {idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={handleCompleteInterview}
            disabled={isSubmittingFinal}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSubmittingFinal ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <span>Finish & Evaluate</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Split Screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Question Details, Live Transcript, Notes */}
        <div className="lg:col-span-7 h-full overflow-y-auto p-6 bg-white border-r border-slate-200 space-y-6">
          {/* Question Meta Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {currentQuestion.stageName}
              </span>
              {currentQuestion.questionType && (
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {currentQuestion.questionType}
                </span>
              )}
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                currentQuestion.difficulty === 'Hard'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {currentQuestion.difficulty} Difficulty
            </span>
          </div>

          {/* Question Text */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-slate-900 leading-relaxed max-w-3xl">
              {currentQuestion.questionText}
            </h2>

            {/* Strict Grounding Evidence Box */}
            {(currentQuestion.exactSourceExcerpt || currentQuestion.resumeAnchor) && (
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-700 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-800 font-semibold text-[11px] uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Resume Grounding • {currentQuestion.resumeAnchor || 'Candidate Resume'}</span>
                </div>
                {currentQuestion.exactSourceExcerpt && (
                  <p className="italic text-[11px] text-slate-600 font-mono bg-white/70 p-2 rounded-md border border-blue-50">
                    "{currentQuestion.exactSourceExcerpt}"
                  </p>
                )}
              </div>
            )}
            
            {/* Action Buttons for Details & Hints */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              {(currentQuestion.contextPrompt || (currentQuestion.evaluationCriteria && currentQuestion.evaluationCriteria.length > 0)) && (
                <button
                  type="button"
                  onClick={() => setShowContext((prev) => !prev)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>{showContext ? 'Hide Context & Rubric' : 'View Context & Rubric'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHint((prev) => !prev)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>{showHint ? 'Hide Hint' : 'Reveal Hint (No Penalty)'}</span>
              </button>
            </div>

            {/* Expandable Context & Rubric */}
            {showContext && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {currentQuestion.contextPrompt && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800 block mb-1">
                      Context & Focus:
                    </span>
                    {currentQuestion.contextPrompt}
                  </div>
                )}
                {currentQuestion.evaluationCriteria && currentQuestion.evaluationCriteria.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider block">
                      Rubric Criteria
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {currentQuestion.evaluationCriteria.map((crit, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>{crit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expandable Interviewer Hint */}
            {showHint && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="font-semibold">Interviewer Tip: </span>
                {currentQuestion.hint}
              </div>
            )}
          </div>

          {/* Live Verbal Transcript Textarea */}
          <div className="space-y-4">
            {micError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <span className="leading-snug">{micError}</span>
                <button
                  type="button"
                  onClick={() => requestMicPermission()}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-[11px] shrink-0 ml-2"
                >
                  Enable Mic
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Mic className={`w-3.5 h-3.5 ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                  Candidate Verbal Answer
                </label>
                {isRecording && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                    Live Transcribing...
                  </span>
                )}
              </div>
              <textarea
                rows={4}
                value={
                  (verbalAnswers[currentQuestionIndex] || '') +
                  (interimTranscript ? ` [${interimTranscript}...]` : '')
                }
                onChange={(e) =>
                  setVerbalAnswers({
                    ...verbalAnswers,
                    [currentQuestionIndex]: e.target.value,
                  })
                }
                placeholder="Spoken answers transcribe here automatically when the microphone is recording. You can also edit or type directly..."
                className="w-full text-sm p-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 transition resize-none"
              />
            </div>

            {/* Candidate Written Notes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="notes" className="text-xs font-semibold text-slate-800">
                  Technical Notes & Bullet Points
                </label>
                <span className="text-[10px] text-slate-500 font-medium">Evaluated alongside verbal answer</span>
              </div>
              <textarea
                id="notes"
                rows={3}
                value={candidateNotes[currentQuestionIndex] || ''}
                onChange={(e) =>
                  setCandidateNotes({
                    ...candidateNotes,
                    [currentQuestionIndex]: e.target.value,
                  })
                }
                placeholder="Outline architecture steps, data structures, trade-offs, or formulas..."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-slate-700 transition resize-none"
              />
            </div>
          </div>

          {/* Probing & Evaluation Action Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateFollowUp}
                disabled={isGeneratingFollowUp}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition shadow-sm disabled:opacity-50"
              >
                {isGeneratingFollowUp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span>Ask AI Probing Follow-Up</span>
              </button>

              <button
                type="button"
                onClick={handleEvaluateAnswer}
                disabled={isEvaluatingAnswer}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shadow-sm disabled:opacity-50"
              >
                {isEvaluatingAnswer ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>Score Question Answer</span>
              </button>
            </div>
          </div>

          {/* Follow-Up Card */}
          {activeFollowUp && (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Interviewer Follow-Up Probe
                </span>
                <span className="text-[10px] text-blue-600 font-medium">
                  Depth & Nuance
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900">
                "{activeFollowUp.followUpText}"
              </p>
              {activeFollowUp.targetInsight && (
                <p className="text-[11px] text-slate-600 italic">
                  Focus: {activeFollowUp.targetInsight}
                </p>
              )}
            </div>
          )}

          {/* Evaluation Card */}
          {activeEval && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                  Answer Evaluated
                </span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                  {activeEval.candidateAnswer || activeEval.candidateNotes || 'No answer provided'}
                </p>
              </div>
              {/* Header with Title, Score, and Question Addressed Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Strict Rubric Evaluation
                  </span>
                  {activeEval.evaluationConfidence && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        activeEval.evaluationConfidence === 'High'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : activeEval.evaluationConfidence === 'Moderate'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {activeEval.evaluationConfidence}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeEval.questionAddressed && (
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        activeEval.questionAddressed === 'Fully Addressed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : activeEval.questionAddressed === 'Partially Addressed'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      {activeEval.questionAddressed}
                    </span>
                  )}
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900 text-white">
                    Score: {activeEval.overallQuestionScore}%
                  </span>
                </div>
              </div>

              {/* Off-topic or Avoidance Notice Alert */}
              {activeEval.offTopicOrAvoidanceNotice && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Answer Did Not Address Question</strong>
                    <p className="mt-0.5 leading-relaxed">{activeEval.offTopicOrAvoidanceNotice}</p>
                  </div>
                </div>
              )}

              {/* 4 Core Pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block font-medium">Relevance</span>
                  <span className="font-bold text-sm text-slate-900">{activeEval.relevance}%</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block font-medium">Technical Accuracy</span>
                  <span className="font-bold text-sm text-slate-900">
                    {activeEval.technicalAccuracyScore ?? activeEval.technicalCorrectness}%
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block font-medium">Completeness</span>
                  <span className="font-bold text-sm text-slate-900">
                    {activeEval.completeness ?? activeEval.problemSolving}%
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block font-medium">Clarity</span>
                  <span className="font-bold text-sm text-slate-900">
                    {activeEval.clarity ?? activeEval.communication}%
                  </span>
                </div>
              </div>

              {/* Recruiter Verdict */}
              {activeEval.recruiterVerdict && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
                  <strong className="text-slate-900 block font-bold mb-0.5">Recruiter Assessment:</strong>
                  {activeEval.recruiterVerdict}
                </div>
              )}

              {/* What Was Correct (Evidenced in Transcript) */}
              {activeEval.whatWasCorrect && activeEval.whatWasCorrect.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    What Was Correct (Demonstrated in Transcription)
                  </span>
                  <div className="space-y-1">
                    {activeEval.whatWasCorrect.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Was Missing / Omitted */}
              {activeEval.whatWasMissing && activeEval.whatWasMissing.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    What Was Missing / Omitted
                  </span>
                  <div className="space-y-1">
                    {activeEval.whatWasMissing.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Could Be Improved */}
              {activeEval.whatCouldBeImproved && activeEval.whatCouldBeImproved.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    Actionable Improvements
                  </span>
                  <div className="space-y-1">
                    {activeEval.whatCouldBeImproved.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expected Key Points */}
              {activeEval.expectedKeyPoints && activeEval.expectedKeyPoints.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-slate-600" />
                    Expected Key Points (Strong Answer Benchmark)
                  </span>
                  <ul className="text-xs text-slate-700 space-y-1 pl-4 list-disc">
                    {activeEval.expectedKeyPoints.map((kp, idx) => (
                      <li key={idx} className="leading-snug">{kp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transcription Evidence Footnote */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  Evaluated strictly from {activeEval.transcriptWordCount ?? 0} recorded words
                </span>
                {activeEval.uncertaintyNote && (
                  <span className="text-amber-700 font-medium italic">
                    {activeEval.uncertaintyNote}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Webcam Feed & Voice Telemetry */}
        <div className="lg:col-span-5 h-full p-6 flex flex-col justify-between bg-slate-50 overflow-y-auto space-y-4">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Webcam & Posture Feed
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Microphone: {isRecording ? 'Active' : 'Standby'}
              </span>
            </div>

            <div className="flex-1 min-h-[300px]">
              <WebcamPreview
                candidateName={candidateName}
                isAudioRecording={isRecording}
                onToggleRecording={toggleRecording}
                onEyeContactUpdate={updateEyeContact}
                analyzer={videoAnalyzerRef.current}
              />
            </div>
          </div>

          {/* Live Delivery & Vocal Telemetry Dashboard */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Live Delivery & Vocal Telemetry
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isRecording && isSpeaking
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold animate-pulse'
                    : isRecording
                    ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRecording && isSpeaking
                      ? 'bg-emerald-500'
                      : isRecording
                      ? 'bg-blue-500'
                      : 'bg-slate-400'
                  }`}
                />
                {isRecording && isSpeaking
                  ? 'Candidate Speaking'
                  : isRecording
                  ? 'Listening / Pause'
                  : 'Hardware Standby'}
              </span>
            </div>

            {/* 3 Real-time Delivery Core Cards */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {/* Pacing Card */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Pacing</span>
                  <span
                    className={`font-bold text-sm block my-0.5 ${
                      telemetry.wpmStatus === 'Optimal'
                        ? 'text-emerald-700'
                        : telemetry.wpmStatus === 'Fast'
                        ? 'text-amber-700'
                        : telemetry.wpmStatus === 'Slow'
                        ? 'text-blue-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {telemetry.wpm > 0
                      ? `${telemetry.wpm} WPM`
                      : isRecording
                      ? 'Calibrating...'
                      : '0 WPM'}
                  </span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold truncate ${
                    telemetry.wpmStatus === 'Optimal'
                      ? 'bg-emerald-100/70 text-emerald-800'
                      : telemetry.wpmStatus === 'Fast'
                      ? 'bg-amber-100/70 text-amber-800'
                      : telemetry.wpmStatus === 'Slow'
                      ? 'bg-blue-100/70 text-blue-800'
                      : 'bg-slate-200/60 text-slate-600'
                  }`}
                >
                  {telemetry.wpmStatus === 'Optimal' ? '120-165 WPM' : telemetry.wpmStatus}
                </span>
              </div>

              {/* Eye Contact Card */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Eye Contact</span>
                  <span
                    className={`font-bold text-sm block my-0.5 ${
                      telemetry.eyeContactPct >= 80
                        ? 'text-blue-700'
                        : telemetry.eyeContactPct > 0
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {telemetry.eyeContactPct > 0 ? `${telemetry.eyeContactPct}%` : 'Muted'}
                  </span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold truncate ${
                    telemetry.eyeContactPct >= 80
                      ? 'bg-blue-100/70 text-blue-800'
                      : telemetry.eyeContactPct > 0
                      ? 'bg-amber-100/70 text-amber-800'
                      : 'bg-slate-200/60 text-slate-600'
                  }`}
                >
                  {telemetry.eyeContactStatus}
                </span>
              </div>

              {/* Clarity & Fillers Card */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Clarity</span>
                  <span
                    className={`font-bold text-sm block my-0.5 ${
                      telemetry.clarityStatus === 'High'
                        ? 'text-emerald-700'
                        : telemetry.clarityStatus === 'Good'
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {telemetry.clarityStatus}
                  </span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold truncate ${
                    telemetry.fillersCount === 0
                      ? 'bg-emerald-100/70 text-emerald-800'
                      : telemetry.fillersCount <= 2
                      ? 'bg-amber-100/70 text-amber-800'
                      : 'bg-rose-100/70 text-rose-800'
                  }`}
                >
                  {telemetry.fillersCount === 0
                    ? '0 fillers'
                    : `${telemetry.fillersCount} filler${telemetry.fillersCount > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* Live Vocal Modulation Energy & Speech Activity Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-blue-600" />
                  Live Vocal Modulation
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {isRecording ? `${vocalAudioLevel}% RMS` : 'Ready'}
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-75 ${
                    vocalAudioLevel > 70
                      ? 'bg-amber-500'
                      : vocalAudioLevel > 15
                      ? 'bg-emerald-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${isRecording ? Math.max(4, vocalAudioLevel) : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
                <span>Active Speech: {telemetry.speakingTimeSeconds}s</span>
                <span>Thinking Pause: {telemetry.silenceTimeSeconds}s</span>
                <span className="truncate max-w-[140px]">
                  {telemetry.detectedFillers.length > 0
                    ? `Fillers: ${telemetry.detectedFillers.slice(0, 2).join(', ')}`
                    : 'Clean articulation'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Voice & Stage Navigation Bar */}
      <footer className="h-20 bg-white border-t border-slate-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-lg">
        {/* Left: Waveform */}
        <div className="flex items-center gap-4">
          <AudioWaveform
            isRecording={isRecording}
            analyser={analyserNode}
            audioLevel={vocalAudioLevel}
            onAudioLevelChange={setAudioLevel}
          />
          <div className="hidden sm:block border-l border-slate-200 pl-4">
            <p className="text-xs font-semibold text-slate-900">
              {isRecording ? 'Answer Recording in Progress' : 'Microphone Ready'}
            </p>
            <p className="text-[10px] text-slate-500">
              {isRecording ? 'Spoken response is transcribing' : 'Click to start speaking'}
            </p>
          </div>
        </div>

        {/* Center: Record Button */}
        <button
          type="button"
          onClick={toggleRecording}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Recording</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Start Answer</span>
            </>
          )}
        </button>

        {/* Right: Stage Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Previous Stage</span>
          </button>

          {currentQuestionIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition"
            >
              <span>Next Stage</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteInterview}
              disabled={isSubmittingFinal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Submit & View Results</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
