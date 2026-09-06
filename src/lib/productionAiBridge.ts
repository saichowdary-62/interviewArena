// Production AI Diagnostic & Resilient Fallback Bridge
// Detects exact deployment environment, Netlify static hosting, Gemini API status codes, and network errors.

import {
  localGenerateFollowup,
  localEvaluateAnswer,
  localGenerateQuestions,
  localGenerateCustomQuestions,
  localResumeAnalysis,
  localCompleteEvaluation,
} from './localFallbackEngines.js';
import { CompetencyFramework, getCompetencyFramework } from './competencyFrameworks.js';
import {
  EvaluationReport,
  InterviewQuestion,
  QuestionEvaluation,
  ResumeAnalysisData,
  VideoAnalysisReport,
} from '../types.js';

export interface AiDiagnosticReport {
  timestamp: string;
  connected: boolean;
  status: number;
  message: string;
  apiKeyConfigured: boolean;
  maskedKey?: string;
  activeProvider?: string;
  activeModel?: string;
  sourceKeyName?: string;
  latencyMs?: number;
  isNetlifyStatic?: boolean;
  isQuotaExhausted?: boolean;
  code?: string;
  troubleshooting?: string;
  runtime?: {
    nodeVersion?: string;
    platform?: string;
    port?: number;
    env?: string;
  };
}

/**
 * Probes the backend server diagnostics endpoint to check Gemini API connectivity and deployment state.
 */
export async function probeAiDiagnostics(): Promise<AiDiagnosticReport> {
  const t0 = Date.now();
  try {
    const res = await fetch('/api/ai/diagnostics', {
      method: 'GET',
      headers: { credentials: 'omit' },
    });

    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    if (res.status === 404 || isHtml) {
      return {
        timestamp: new Date().toISOString(),
        connected: false,
        status: 404,
        isNetlifyStatic: true,
        apiKeyConfigured: false,
        code: 'STATIC_HOST_NO_SERVER',
        message:
          'Backend server endpoint returned HTTP 404 (or HTML document). The site is running as a static build (e.g. on Netlify) where the Express backend (server.ts) is not executing.',
        troubleshooting:
          'To run Gemini server-side, deploy on a Node.js container host (Render, Google Cloud Run, Railway, Heroku) or configure Netlify Functions with an API proxy. The client-side zero-hallucination precision engine is currently active to keep the platform functional.',
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        timestamp: new Date().toISOString(),
        connected: false,
        status: res.status,
        apiKeyConfigured: false,
        code: `HTTP_${res.status}`,
        message: errJson?.message || `Server returned HTTP ${res.status}`,
        troubleshooting: 'Check hosting environment variables and server logs.',
      };
    }

    const data = await res.json();
    const livePing = data.livePing || {};

    return {
      timestamp: data.timestamp || new Date().toISOString(),
      connected: Boolean(livePing.connected),
      status: livePing.status || 200,
      message: livePing.message || 'Diagnostic complete',
      apiKeyConfigured: Boolean(data.keyConfiguration?.configured),
      maskedKey: data.keyConfiguration?.maskedKey,
      activeProvider: data.aiArchitecture?.activeProvider || data.keyConfiguration?.provider,
      activeModel: data.aiArchitecture?.activeModel,
      sourceKeyName: data.aiArchitecture?.sourceKeyName || data.keyConfiguration?.variableName,
      latencyMs: livePing.latencyMs,
      isQuotaExhausted: Boolean(livePing.isQuotaExhausted),
      code: livePing.code,
      troubleshooting: livePing.troubleshooting,
      runtime: data.aiArchitecture?.runtime,
    };
  } catch (err: any) {
    const latency = Date.now() - t0;
    return {
      timestamp: new Date().toISOString(),
      connected: false,
      status: 0,
      latencyMs: latency,
      apiKeyConfigured: false,
      code: 'NETWORK_FETCH_FAILURE',
      message: err?.message || 'Network / CORS connection error connecting to /api/ai/diagnostics',
      troubleshooting:
        'The browser could not reach the backend server. Verify network connection and backend hosting status.',
    };
  }
}

/**
 * Resilient question generator with exact error diagnostics.
 */
export async function resilientGenerateQuestions(params: {
  roleTrack: string;
  companyBenchmark: string;
  resumeText: string;
  parsedResume?: any;
  jobDescription?: string;
  difficulty?: string;
  customQuestions?: string;
  questionCount?: number;
  recentQuestionTexts?: string[];
}): Promise<{
  questions: InterviewQuestion[];
  source: string;
  aiError?: any;
  diagnosticsMessage?: string;
}> {
  const { roleTrack, companyBenchmark, resumeText, parsedResume, jobDescription, difficulty, customQuestions, questionCount = 6, recentQuestionTexts = [] } = params;
  const effectiveResume = resumeText || (parsedResume ? JSON.stringify(parsedResume) : '');
  const framework = getCompetencyFramework(roleTrack);

  if (customQuestions?.trim()) {
    return {
      questions: localGenerateCustomQuestions(customQuestions, roleTrack, difficulty || 'Medium', companyBenchmark, questionCount),
      source: 'deterministic_custom_questions',
    };
  }

  try {
    const res = await fetch('/api/interview/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleTrack,
        companyBenchmark,
        resumeText: effectiveResume,
        parsedResume,
        jobDescription,
        difficulty,
        customQuestions,
        count: questionCount,
        recentQuestionTexts,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    // Detect Netlify static hosting (404 or HTML fallback)
    if (res.status === 404 || isHtml) {
      console.warn('[Production AI Bridge] Backend returned 404/HTML. Engaging client-side precision engine.');
      const fallbackQuestions = localGenerateQuestions(effectiveResume, roleTrack, companyBenchmark, framework, recentQuestionTexts, questionCount, difficulty);
      return {
        questions: fallbackQuestions,
        source: 'client_local_precision_engine',
        aiError: {
          status: 404,
          code: 'STATIC_HOST_SERVER_OFFLINE',
          message: 'Backend server endpoint (/api/interview/generate-questions) returned 404. Netlify static hosting detected: Express server is not running.',
        },
        diagnosticsMessage: 'Static deployment detected: Generated curriculum-anchored questions via client-side zero-hallucination engine.',
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('[Production AI Bridge] /api/interview/generate-questions returned non-OK status:', res.status, errJson);
      const fallbackQuestions = localGenerateQuestions(effectiveResume, roleTrack, companyBenchmark, framework, recentQuestionTexts, questionCount, difficulty);
      return {
        questions: fallbackQuestions,
        source: 'client_local_precision_engine',
        aiError: {
          status: res.status,
          code: errJson?.aiError?.code || `HTTP_${res.status}`,
          message: errJson?.aiError?.message || errJson?.error || `Server returned HTTP ${res.status}`,
          details: errJson?.aiError?.details || errJson?.details,
        },
        diagnosticsMessage: `Server error (${res.status}): Engaged zero-hallucination local engine.`,
      };
    }

    const data = await res.json();
    if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
      const selectedQuestions = data.questions
        .slice(0, Math.max(1, questionCount))
        .map((question: InterviewQuestion, index: number, questions: InterviewQuestion[]) => ({
          ...question,
          difficulty: difficulty?.toLowerCase().includes('easy') ? 'Easy' : difficulty?.toLowerCase().includes('hard') || difficulty?.toLowerCase().includes('staff') || difficulty?.toLowerCase().includes('principal') ? 'Hard' : 'Medium',
          id: index + 1,
          questionNumber: index + 1,
          totalQuestions: questions.length,
        }));
      return {
        questions: selectedQuestions,
        source: data.source || 'gemini_3.8_flash',
        aiError: data.aiError,
      };
    }

    // Empty questions returned
    const fallbackQuestions = localGenerateQuestions(effectiveResume, roleTrack, companyBenchmark, framework, recentQuestionTexts, questionCount, difficulty);
    return {
      questions: fallbackQuestions,
      source: 'client_local_precision_engine',
      diagnosticsMessage: 'Empty questions payload received: Engaged zero-hallucination local engine.',
    };
  } catch (err: any) {
    console.warn('[Production AI Bridge] Network failure calling generate-questions:', err);
    const fallbackQuestions = localGenerateQuestions(effectiveResume, roleTrack, companyBenchmark, framework, recentQuestionTexts, questionCount, difficulty);
    return {
      questions: fallbackQuestions,
      source: 'client_local_precision_engine',
      aiError: {
        status: 0,
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network request failed',
      },
      diagnosticsMessage: 'Network failure reaching backend: Engaged zero-hallucination local engine.',
    };
  }
}

/**
 * Resilient answer evaluation with exact error diagnostics.
 */
export async function resilientEvaluateAnswer(params: {
  question: InterviewQuestion;
  candidateAnswer: string;
  candidateNotes: string;
  elapsedSeconds: number;
}): Promise<{
  evaluation: QuestionEvaluation;
  source: string;
  aiError?: any;
}> {
  const { question, candidateAnswer, candidateNotes, elapsedSeconds } = params;

  try {
    const res = await fetch('/api/interview/evaluate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        candidateAnswer,
        candidateNotes,
        elapsedSeconds,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    if (res.status === 404 || isHtml) {
      const localEval = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
      return {
        evaluation: localEval,
        source: 'client_local_precision_engine',
        aiError: {
          status: 404,
          code: 'STATIC_HOST_SERVER_OFFLINE',
          message: 'Server endpoint returned 404 (Netlify static hosting). Evaluated via client precision engine.',
        },
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const localEval = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
      return {
        evaluation: localEval,
        source: 'client_local_precision_engine',
        aiError: {
          status: res.status,
          code: errJson?.aiError?.code || `HTTP_${res.status}`,
          message: errJson?.aiError?.message || errJson?.error || `Server HTTP ${res.status}`,
        },
      };
    }

    const data = await res.json();
    return {
      evaluation: data.evaluation || localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds),
      source: data.source || 'gemini_3.8_flash',
      aiError: data.aiError,
    };
  } catch (err: any) {
    const localEval = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
    return {
      evaluation: localEval,
      source: 'client_local_precision_engine',
      aiError: {
        status: 0,
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network request failed',
      },
    };
  }
}

/**
 * Resilient final session evaluation report with exact error diagnostics.
 */
export async function resilientCompleteEvaluation(params: {
  sessionQuestions: InterviewQuestion[];
  answers: Record<number, string>;
  notes: Record<number, string>;
  elapsedSeconds: number;
  candidateProfile: any;
  videoAnalysis?: VideoAnalysisReport;
}): Promise<{
  report: EvaluationReport;
  source: string;
  aiError?: any;
}> {
  const { sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis } = params;

  try {
    const res = await fetch('/api/interview/complete-evaluation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionQuestions,
        answers,
        notes,
        elapsedSeconds,
        candidateProfile,
        videoAnalysis,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    if (res.status === 404 || isHtml) {
      const localRep = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
      return {
        report: localRep,
        source: 'client_local_precision_engine',
        aiError: {
          status: 404,
          code: 'STATIC_HOST_SERVER_OFFLINE',
          message: 'Server endpoint returned 404 (Netlify static hosting). Evaluated via client precision engine.',
        },
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const localRep = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
      return {
        report: localRep,
        source: 'client_local_precision_engine',
        aiError: {
          status: res.status,
          code: errJson?.aiError?.code || `HTTP_${res.status}`,
          message: errJson?.aiError?.message || errJson?.error || `Server HTTP ${res.status}`,
        },
      };
    }

    const data = await res.json();
    const finalReport = data.report || localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
    if (videoAnalysis && !finalReport.videoAnalysis) {
      finalReport.videoAnalysis = videoAnalysis;
    }
    return {
      report: finalReport,
      source: data.source || 'gemini_3.8_flash',
      aiError: data.aiError,
    };
  } catch (err: any) {
    const localRep = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
    return {
      report: localRep,
      source: 'client_local_precision_engine',
      aiError: {
        status: 0,
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network request failed',
      },
    };
  }
}
