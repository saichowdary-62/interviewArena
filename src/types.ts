export type NavigationTab = 'dashboard' | 'interviews' | 'resume' | 'reports' | 'settings' | 'landing';

export interface InterviewerInfo {
  name: string;
  role: string;
  companyBenchmark: string;
  avatarInitials: string;
}

export type InterviewStageType =
  | 'Stage 1: Resume Verification'
  | 'Stage 2: Candidate Project Deep Dive'
  | 'Stage 3: Technical Competency'
  | 'Stage 4: Scenario Problem Solving'
  | 'Stage 5: Behavioral & Situational'
  | 'Stage 6: Final Candidate Evaluation';

export interface InterviewQuestion {
  id: number;
  questionNumber: number;
  totalQuestions: number;
  stage?: number; // 1 to 6
  stageName?: string; // One of the 6 structured stages
  resumeAnchor?: string; // Exact project, skill, or metric anchor from candidate's resume
  questionType?: 'Project-Based' | 'Skill-Based' | 'Experience-Based';
  exactSourceExcerpt?: string; // Verbatim quote from resume
  track: string;
  title: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeAllowedSeconds: number;
  questionText: string;
  contextPrompt: string;
  interviewer: InterviewerInfo;
  evaluationCriteria: string[];
  hint: string;
  sampleKeyPoints: string[];
}

export interface InterviewSession {
  id: string;
  title: string;
  roleTrack: string;
  companyBenchmark: string;
  date: string;
  score: number;
  status: 'completed' | 'scheduled' | 'in_progress';
  durationMinutes: number;
  strengthsCount: number;
  improvementsCount: number;
  keyFeedback: string;
}

export interface CandidateProfile {
  name: string;
  email: string;
  targetRole: string;
  targetCompanyTrack: string;
  institution: string;
  batchYear: string;
  readinessScore: number;
  readinessDelta: number;
  interviewsCompleted: number;
  avgPerformance: number;
  improvementAreasCount: number;
}

export interface SkillCategory {
  category: string;
  skills: {
    name: string;
    level: 'Advanced' | 'Proficient' | 'Working';
    verifiedByProject?: boolean;
    sourceText?: string;
    resumeSection?: string;
    confidenceScore?: number;
  }[];
}

export interface ExtractedSkillDetail {
  name: string;
  sourceText: string;
  resumeSection: string;
  confidenceScore: number;
  status: 'Verified' | 'Not Found';
  category: string;
  evidence: string;
}

export interface IdentifiedProject {
  name: string;
  role: string;
  tech: string[];
  metrics: string;
  talkingPoints: string[];
  sourceSection?: string;
}

export interface CandidateStrength {
  title: string;
  detail: string;
  evidence: string;
}

export interface MissingSkill {
  skill: string;
  category: string;
  importance: 'High' | 'Medium';
  recommendation: string;
}

export type RecruitmentAssessmentRating = 'Strong Match' | 'Moderate Match' | 'Low Match' | 'High Risk';

export interface RoleMatchBreakdown {
  recruitmentAssessment: RecruitmentAssessmentRating;
  assessmentExplanation: string;
  skillMatchPercentage: number;
  requiredSkillsTotal: number;
  requiredSkillsMatched: number;
  preferredSkillsTotal: number;
  preferredSkillsMatched: number;
  matchedRequired: {
    skill: string;
    evidence: string;
    sourceText: string;
    confidence: number;
  }[];
  missingRequired: {
    skill: string;
    reason: string;
    recommendation: string;
  }[];
  matchedPreferred: {
    skill: string;
    evidence: string;
    sourceText: string;
    confidence: number;
  }[];
  missingPreferred: {
    skill: string;
    recommendation: string;
  }[];
}

export interface VerifiedSkillFact {
  skill: string;
  exactResumeText: string;
  sectionFound: string;
  confidence: string; // e.g., "100%"
}

export interface VerifiedProjectFact {
  projectName: string;
  exactResumeText: string;
  sectionFound: string;
  technologies: string[];
  metrics?: string;
}

export interface VerifiedCertificationFact {
  certificationName: string;
  exactResumeText: string;
  sectionFound: string;
  issuerOrYear?: string;
}

export interface VerifiedExperienceFact {
  role: string;
  organization: string;
  exactResumeText: string;
  sectionFound: string;
  duration?: string;
}

export interface VerifiedResumeFacts {
  skillsFound: VerifiedSkillFact[];
  projectsFound: VerifiedProjectFact[];
  certificationsFound: VerifiedCertificationFact[];
  experienceFound: VerifiedExperienceFact[];
}

export interface ExtractionMethodAttempt {
  method: 'PDF.js' | 'pdf-parse' | 'OCR Fallback' | 'Direct Text';
  status: 'success' | 'failed' | 'skipped';
  charsExtracted: number;
  durationMs?: number;
  error?: string;
}

export interface ResumeParserDiagnostics {
  fileName: string;
  fileSize: string;
  totalPages: number;
  extractedCharacterCount: number;
  extractionMethodUsed: 'PDF.js' | 'pdf-parse' | 'OCR Fallback' | 'Direct Text';
  first500Chars: string;
  ocrRequired: boolean;
  attempts: ExtractionMethodAttempt[];
  rootCause?: string;
}

export interface ResumeAnalysisData {
  filename: string;
  uploadedAt: string;
  fileSize: string;
  targetRole: string;
  roleMatchPercentage: number;
  atsScore?: number;
  rawTextSnippet?: string;
  extractedText?: string;
  rawText?: string;
  diagnostics?: ResumeParserDiagnostics;
  verifiedFacts?: VerifiedResumeFacts;
  explicitSkills?: ExtractedSkillDetail[];
  matchBreakdown?: RoleMatchBreakdown;
  skillsExtracted: SkillCategory[];
  projectsIdentified: IdentifiedProject[];
  strengths: CandidateStrength[];
  missingSkills: MissingSkill[];
}

export interface DimensionScore {
  name: string;
  score: number;
  maxScore: number;
  status: string;
  benchmark: number;
  feedback: string;
}

export interface ParameterEvaluation {
  score: number;
  justification: string;
  highlights: string[];
  mistakes: string[];
  idealComparison: string;
}

export interface QuestionEvaluation {
  candidateAnswer?: string;
  candidateNotes?: string;
  // Core 4 Pillar Scores (Requirements 1, 9)
  relevance?: number; // 0-100 (Relevance directly to the question asked)
  technicalAccuracyScore?: number; // 0-100 (Technical accuracy of demonstrated points)
  completeness?: number; // 0-100 (Completeness against expected key points)
  clarity?: number; // 0-100 (Clarity and structure of verbal explanation)
  overallQuestionScore?: number; // 0-100 (Honest weighted score, uninflated)

  // Backward compatibility aliases
  score?: number;
  technicalCorrectness?: number;
  communication?: number;
  problemSolving?: number;

  // Direct Question Alignment & Anti-Avoidance (Requirements 1, 5, 8)
  questionAddressed?: 'Fully Addressed' | 'Partially Addressed' | 'Did Not Address Question' | 'Off-Topic / Avoided';
  offTopicOrAvoidanceNotice?: string; // Explicit statement if answer was unrelated or avoided

  // Structured Recruiter-Style Breakdown (Requirements 5, 6, 7)
  whatWasCorrect?: string[]; // Specific accurate points evidenced directly in the transcript
  whatWasMissing?: string[]; // Critical missing components or omitted criteria
  whatCouldBeImproved?: string[]; // Concrete actionable recruiter recommendations
  factualErrorsOrGaps?: string[]; // Factual mistakes or inaccuracies in the candidate's explanation

  // Expected Benchmarks (Requirement 10)
  expectedKeyPoints?: string[]; // Key technical elements a strong answer should have included
  idealAnswerComparison?: string; // Exemplary response summary

  // Transcription Truth & Uncertainty (Requirements 2, 3, 4, 11, 12)
  evaluationConfidence?: 'High' | 'Moderate' | 'Low (Uncertain/Sparse Transcription)';
  uncertaintyNote?: string; // Stated uncertainty if transcription is brief or low confidence
  transcriptWordCount?: number;
  evidenceQuotes?: string[]; // Quotes directly from candidate transcription

  // Feedback Summaries
  recruiterVerdict?: string; // Honest recruiter takeaway
  technicalFeedback?: string;
  communicationFeedback?: string;
  relevanceFeedback?: string;
  problemSolvingFeedback?: string;
  identifiedStrengths?: string[];
  areasForImprovement?: string[];
  recommendedFollowUp?: string;
  technicalAccuracy?: string;
  depthOfExplanation?: string;
  communicationClarity?: string;
  keyStrengths?: string[];
  missingElements?: string[];
  idealAnswerOutline?: string;
  feedback?: string;
}

export interface RecommendedLearningResource {
  title: string;
  type: 'Documentation' | 'Course' | 'Book' | 'Practice';
  topic: string;
  url?: string;
  description: string;
}

export interface RadarDataPoint {
  subject: string;
  score: number;
  benchmark: number;
  fullMark: number;
}

export interface HeatmapItem {
  skill: string;
  category: string;
  mastery: 'Mastered' | 'Proficient' | 'Developing' | 'Needs Focus';
  score: number;
  trend: 'up' | 'stable' | 'down';
  interviewsCount: number;
}

export interface RoadmapItem {
  id: string;
  stage: string;
  focus: string;
  priority: 'Critical' | 'High' | 'Medium';
  description: string;
  action: string;
  estHours: number;
  status: 'todo' | 'in_progress' | 'completed';
}

export interface EvaluationReport {
  overallScore: number;
  percentile: number;
  verdict: string;
  evaluationDate: string;
  cohortSize: number;
  evaluationParameters?: {
    technicalAccuracy: ParameterEvaluation;
    communicationClarity: ParameterEvaluation;
    problemSolvingStructure: ParameterEvaluation;
    depthOfKnowledge: ParameterEvaluation;
    confidenceAndDelivery: ParameterEvaluation;
  };
  recommendedResources?: RecommendedLearningResource[];
  dimensions: DimensionScore[];
  radarMetrics: RadarDataPoint[];
  skillHeatmap: HeatmapItem[];
  improvementRoadmap: RoadmapItem[];
  historyTimeline: InterviewSession[];
  questionEvaluations?: QuestionEvaluation[];
  videoAnalysis?: VideoAnalysisReport;
}

export interface VideoEvidenceObservation {
  id: string;
  timestamp: string; // e.g. "01:24"
  seconds: number;
  category: 'Eye Contact' | 'Facial Expression' | 'Confidence' | 'Posture & Movement' | 'Speaking Cadence';
  observation: string;
  type: 'positive' | 'neutral' | 'improvement';
  certainty: 'Verified' | 'Probable' | 'Low Confidence';
}

export interface VideoDimensionAnalysis {
  score: number; // 0-100
  benchmark: number;
  status: 'Exemplary' | 'Proficient' | 'Developing' | 'Needs Attention';
  confidenceLevel: 'High' | 'Moderate' | 'Low / Uncertain';
  evidence: string;
  recruiterFeedback: string;
  metrics?: Record<string, string | number>;
}

export interface VideoAnalysisDiagnostics {
  sampleRateFps: number;
  totalSamples: number;
  analyzedFramesCount: number;
  droppedFrames: number;
  averageFaceConfidence: number; // 0-100
  lightingIndex: number; // 0-255
  lightingAssessment: 'Optimal Illuminance' | 'Adequate' | 'Low Light' | 'Backlit';
  framingAdequacy: 'Centered & Upright' | 'Slightly Off-Center' | 'Sub-optimal Framing';
  cameraResolution: string;
  uncertaintyFlags: string[];
  diagnosticAudit: string[];
}

export interface VideoAnalysisReport {
  overallVideoScore: number;
  overallPresenceVerdict: string;
  analysisDurationSeconds: number;
  analyzedFramesCount: number;
  detectionConfidence: 'High' | 'Moderate' | 'Low / Uncertain';
  confidenceReason: string;

  // 7 Core Evaluated Parameters
  eyeContact: VideoDimensionAnalysis & {
    directGazePercentage: number;
    downwardGazePercentage: number;
    lateralDriftPercentage: number;
  };
  facialExpressions: VideoDimensionAnalysis & {
    dominantState: string;
    expressionBreakdown: {
      attentivePct: number;
      confidentPct: number;
      neutralPct: number;
      tensePct: number;
    };
  };
  confidence: VideoDimensionAnalysis & {
    microFidgetingIndex: number;
    headStability: string;
  };
  engagement: VideoDimensionAnalysis & {
    activeListeningNods: number;
    forwardPostureRatio: number;
  };
  speakingConsistency: VideoDimensionAnalysis & {
    audioVisualSync: string;
    paceConsistency: string;
  };
  bodyLanguage: VideoDimensionAnalysis & {
    postureAlignment: string;
    motionEnergyScore: number;
  };
  professionalism: VideoDimensionAnalysis & {
    framingScore: number;
    environmentStability: string;
  };

  evidenceTimeline: VideoEvidenceObservation[];
  actionableRecommendations: string[];
  diagnostics: VideoAnalysisDiagnostics;
}

export interface DeliveryTelemetry {
  wpm: number;
  wpmStatus: 'Calibrating' | 'Slow' | 'Optimal' | 'Fast';
  eyeContactPct: number;
  eyeContactStatus: 'Direct Eye Contact' | 'Good Centering' | 'Looking Away' | 'Low Lighting' | 'Camera Muted' | 'Calibrating';
  clarityPct: number;
  clarityStatus: 'High' | 'Good' | 'Needs Polish';
  fillersCount: number;
  detectedFillers: string[];
  audioLevel: number; // 0-100
  isSpeaking: boolean;
  speakingTimeSeconds: number;
  silenceTimeSeconds: number;
}
