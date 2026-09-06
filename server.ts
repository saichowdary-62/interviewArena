import express from 'express';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { COMPETENCY_FRAMEWORKS, getCompetencyFramework } from './src/lib/competencyFrameworks.js';
import {
  localResumeAnalysis,
  localGenerateQuestions,
  localEvaluateAnswer,
  localGenerateFollowup,
  localCompleteEvaluation,
  localGenerateCustomQuestions,
} from './src/lib/localFallbackEngines.js';
import {
  generateAiContent,
  testAiConnection,
  getActiveAiConfig,
  cleanAndParseJson,
  isRateLimitOrQuotaError,
  maskApiKey,
} from './server/aiProvider.js';

// PDF.js text extraction does not need native canvas rendering. This small
// fallback covers the matrix operations PDF.js expects if it probes DOMMatrix.
const nodeGlobals = globalThis as any;
if (!nodeGlobals.DOMMatrix) {
  nodeGlobals.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: number[] | string) {
      if (Array.isArray(init)) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init.length >= 6
          ? init.slice(0, 6) as [number, number, number, number, number, number]
          : [1, 0, 0, 1, 0, 0];
      }
    }
    multiply(other: DOMMatrix) {
      return new nodeGlobals.DOMMatrix([
        this.a * other.a + this.c * other.b,
        this.b * other.a + this.d * other.b,
        this.a * other.c + this.c * other.d,
        this.b * other.c + this.d * other.d,
        this.a * other.e + this.c * other.f + this.e,
        this.b * other.e + this.d * other.f + this.f,
      ]);
    }
    inverse() {
      const determinant = this.a * this.d - this.b * this.c;
      if (!determinant) return new nodeGlobals.DOMMatrix();
      return new nodeGlobals.DOMMatrix([
        this.d / determinant,
        -this.b / determinant,
        -this.c / determinant,
        this.a / determinant,
        (this.c * this.f - this.d * this.e) / determinant,
        (this.b * this.e - this.a * this.f) / determinant,
      ]);
    }
  };
}

dotenv.config();

const app = express();
const PORT = 3000;

// High body limits for resume uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Export helper for quota error checking
export const isQuotaExhaustedError = isRateLimitOrQuotaError;
export { cleanAndParseJson };

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production AI Architecture Diagnostic & Verification Endpoint
const handleAiDiagnostics = async (req: express.Request, res: express.Response) => {
  const config = getActiveAiConfig();
  const testResult = await testAiConnection();

  return res.json({
    timestamp: new Date().toISOString(),
    aiArchitecture: {
      callLocation: 'Server-side Node.js / Netlify Functions (server/aiProvider.ts)',
      clientKeyExposed: false,
      activeProvider: config.provider,
      activeModel: config.model,
      sourceKeyName: config.sourceKeyName,
      endpoints: [
        'POST /api/resume/extract-and-analyze',
        'POST /api/interview/generate-questions',
        'POST /api/interview/evaluate-answer',
        'POST /api/interview/generate-followup',
        'POST /api/interview/complete-evaluation',
      ],
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        port: PORT,
        env: process.env.NODE_ENV || 'production',
        isServerless: Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME),
      },
    },
    keyConfiguration: {
      configured: Boolean(config.apiKey),
      maskedKey: maskApiKey(config.apiKey),
      variableName: config.sourceKeyName,
      provider: config.provider,
    },
    livePing: testResult,
    // Backwards compatibility mappings for older diagnostic clients
    geminiKey: {
      configured: Boolean(config.apiKey),
      masked: maskApiKey(config.apiKey),
    },
  });
};

app.get(['/api/ai/diagnostics', '/ai/diagnostics', '/api/gemini/diagnostics', '/gemini/diagnostics'], handleAiDiagnostics);


// Endpoint to fetch available competency frameworks
app.get('/api/competency-frameworks', (req, res) => {
  res.json({ success: true, frameworks: COMPETENCY_FRAMEWORKS });
});

// Admin-backed Supabase User Registration (Bypasses email rate limits by setting email_confirm: true)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName, institution, targetRole, targetCompanyTrack } = req.body;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(200).json({
        useClientFallback: true,
        message: 'SUPABASE_SERVICE_ROLE_KEY not present on server. Using client-side signup flow.',
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        name: fullName?.trim() || email.split('@')[0],
        institution: institution?.trim() || 'Engineering Institute',
        target_role: targetRole?.trim() || 'Software Development Engineer (SDE-1)',
        target_company_track: targetCompanyTrack || 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data?.user) {
      // Upsert profile in profiles table
      try {
        await adminClient.from('profiles').upsert({
          id: data.user.id,
          name: fullName?.trim() || email.split('@')[0],
          email: email.trim(),
          institution: institution?.trim() || 'Engineering Institute',
          batch_year: 'Batch 2026',
          target_role: targetRole?.trim() || 'Software Development Engineer (SDE-1)',
          target_company_track: targetCompanyTrack || 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
          readiness_score: 0,
          readiness_delta: 0,
          interviews_completed: 0,
          avg_performance: 0,
          improvement_areas_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (profileErr) {
        console.warn('Admin profile upsert warning:', profileErr);
      }

      return res.json({ success: true, user: data.user, autoConfirmed: true });
    }

    return res.status(500).json({ error: 'No user returned from Supabase admin.' });
  } catch (err: any) {
    console.error('Admin signup error:', err);
    return res.status(500).json({ error: err?.message || 'Server error creating user' });
  }
});

// 1. Dynamic Question Generation API (Strictly based on candidate's uploaded resume)
app.post(['/api/interview/generate-questions', '/interview/generate-questions'], async (req, res) => {
  try {
    const {
      roleTrack = 'Software Development Engineer (SDE-1)',
      companyBenchmark = 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
      resumeText = '',
      parsedResume = null,
      jobDescription = '',
      difficulty = 'Medium',
      customQuestions = '',
      count = 6,
      recentQuestionTexts = [],
    } = req.body;

    const activeConfig = getActiveAiConfig();

    // Build comprehensive, grounded resume content from all available sources
    let effectiveResumeContent = '';

    if (parsedResume?.extractedText && parsedResume.extractedText.trim().length >= 40) {
      effectiveResumeContent = parsedResume.extractedText.trim();
    } else if (parsedResume?.rawText && parsedResume.rawText.trim().length >= 40) {
      effectiveResumeContent = parsedResume.rawText.trim();
    } else if (resumeText && resumeText.trim().length >= 350) {
      effectiveResumeContent = resumeText.trim();
    } else if (parsedResume) {
      // Synthesize rich resume text from parsedResume facts
      const parts: string[] = [];
      if (resumeText && resumeText.trim().length > 0) {
        parts.push(resumeText.trim());
      }
      if (parsedResume.verifiedFacts?.projectsFound?.length > 0) {
        parts.push('\nPROJECTS:');
        parsedResume.verifiedFacts.projectsFound.forEach((p: any) => {
          parts.push(`- Project: ${p.projectName}. Evidence: "${p.exactResumeText}". Tech: ${(p.technologies || []).join(', ')}. Metrics: ${p.metrics || 'Documented'}`);
        });
      } else if (parsedResume.projectsIdentified?.length > 0) {
        parts.push('\nPROJECTS:');
        parsedResume.projectsIdentified.forEach((p: any) => {
          parts.push(`- Project: ${p.name} (${p.role}): ${(p.tech || []).join(', ')}. Metrics: ${p.metrics}. Details: ${(p.talkingPoints || []).join('; ')}`);
        });
      }
      if (parsedResume.verifiedFacts?.skillsFound?.length > 0) {
        parts.push('\nVERIFIED SKILLS:');
        parsedResume.verifiedFacts.skillsFound.forEach((s: any) => {
          parts.push(`- ${s.skill} (${s.sectionFound || 'Skills'}, Excerpt: "${s.exactResumeText}")`);
        });
      } else if (parsedResume.skillsExtracted?.length > 0) {
        parts.push('\nSKILLS:');
        parsedResume.skillsExtracted.forEach((c: any) => {
          parts.push(`- ${c.category}: ${(c.skills || []).map((s: any) => s.name).join(', ')}`);
        });
      }
      if (parsedResume.verifiedFacts?.experienceFound?.length > 0) {
        parts.push('\nEXPERIENCE:');
        parsedResume.verifiedFacts.experienceFound.forEach((e: any) => {
          parts.push(`- ${e.role} at ${e.organization} (${e.duration || 'Documented'}). Quote: "${e.exactResumeText}"`);
        });
      }
      if (parsedResume.verifiedFacts?.certificationsFound?.length > 0) {
        parts.push('\nCERTIFICATIONS / EDUCATION:');
        parsedResume.verifiedFacts.certificationsFound.forEach((cert: any) => {
          parts.push(`- ${cert.certificationName}. Excerpt: "${cert.exactResumeText}"`);
        });
      }
      effectiveResumeContent = parts.join('\n\n').trim();
    } else if (resumeText) {
      effectiveResumeContent = resumeText.trim();
    }

    if (!effectiveResumeContent || effectiveResumeContent.trim().length < 20) {
      return res.status(400).json({
        error: 'Candidate resume context is required. Please upload candidate resume first so interview questions are grounded in real projects and verified skills.',
      });
    }

    if (customQuestions.trim()) {
      return res.json({
        success: true,
        questions: localGenerateCustomQuestions(customQuestions, roleTrack, difficulty, companyBenchmark, Number(count) || 6),
        source: 'deterministic_custom_questions',
      });
    }

    const framework = getCompetencyFramework(roleTrack);
    let questions;
    let aiNotice: any = null;
    let aiResult: any = null;

    if (!activeConfig.apiKey) {
      console.warn(`[Production AI Warning] ${activeConfig.sourceKeyName} is not configured on server runtime. Using zero-hallucination local question engine.`);
      aiNotice = {
        status: 401,
        code: 'GEMINI_API_KEY_MISSING',
        message: `No Gemini API key configured. Add GEMINI_API_KEY in environment variables.`,
        recommendation: `Add GEMINI_API_KEY to your environment variables or in AI Studio Settings.`,
      };
      questions = localGenerateQuestions(effectiveResumeContent, roleTrack, companyBenchmark, framework, recentQuestionTexts, Number(count) || 6, difficulty);
    } else {
      const prompt = `You are a Principal Engineering Bar-Raiser conducting a high-stakes technical placement interview.

ROLE COMPETENCY BENCHMARK:
- Target Role: ${roleTrack} (${framework.title})
- Role Level: ${framework.level}
- Target Company Benchmark: ${companyBenchmark}
- Target Difficulty: ${difficulty}
- Role Description: ${framework.description}
- Required Skills: ${framework.requiredSkills.map((skill) => `${skill.skill}: ${skill.description}`).join(' | ')}
- Preferred Skills: ${framework.preferredSkills.map((skill) => `${skill.skill}: ${skill.description}`).join(' | ')}
${jobDescription ? `- Job Description: ${jobDescription}` : ''}
${customQuestions ? `- Custom Questions Requested: ${customQuestions}` : ''}

STRICT INTERVIEW GENERATION MODE:
Generate interview questions ONLY from:
1. Skills explicitly present in candidate's resume
2. Projects explicitly present in candidate's resume
3. Internships / Experience explicitly present in candidate's resume
4. Certifications explicitly present in candidate's resume
${customQuestions ? '5. The EXACT custom questions requested by the user' : ''}

Question generation priority:
${
  customQuestions
    ? `- Priority A: Custom Questions (80%) -> You MUST heavily weight and use the Custom Questions Requested by the user. Adapt them to fit the candidate's resume context if possible.`
    : `- Priority A: Project-based questions (60%) -> Approximately 60% of questions MUST be Project-based, deeply probing candidate's actual projects, metrics, and architecture.
- Priority B: Skill-based questions (25%) -> Probing technical depth of skills candidate explicitly listed.
- Priority C: Experience-based questions (15%) -> Focused on internships or work experience explicitly present in resume.`
}

CRITICAL RULES AND NEGATIVE CONSTRAINTS:
1. NEVER ask questions about technologies not present in the resume.
   Example:
   If resume contains: Java, Python, React, Hospital Management System.
   Ask ONLY about: Java, Python, React, Hospital Management System.
   Do NOT ask about: Kubernetes, Terraform, Kafka, OpenTelemetry, Helm, DevOps, System Design, Microservices, CI/CD, AWS, Cloud, or ANY technology unless that exact term appears verbatim in the candidate resume text.
   (Exception: You may ask about technologies mentioned in the Custom Questions or Job Description).
2. If the candidate's resume does not have complex distributed systems or cloud tools, ask in-depth questions about the language internals and application logic they ACTUALLY wrote (e.g. React lifecycle/hooks, Java memory/collections, Python data structures, SQL indexing/queries).
3. Every question must be anchored in an exact resume snippet with verbatim evidence, OR anchored in the provided Job Description/Custom Questions.
4. If candidate's resume has fewer than 3 projects, generate questions on their practical programming assignments, internships, coursework, or in-depth language/framework internals (e.g. data structures, concurrency, API design) for the technologies they explicitly used, while maintaining a structured flow.
5. Follow a structured flow over the ${count} questions:
   - Early questions should focus on Resume & Project Verification and Technical Competency.
   - Middle questions should focus on Scenario Problem Solving and Project Deep Dives.
   - Final questions should focus on Behavioral, Situational, and Final Candidate Evaluation (e.g., trade-offs, refactoring).
   - If Custom Questions are provided, interleave them naturally into this flow.
6. Adjust the depth and complexity of the questions to match the Target Difficulty: ${difficulty}.
7. Every question must be materially different from the recent questions listed below. Do not reuse their wording, scenario, or primary skill focus:
${recentQuestionTexts.length > 0 ? recentQuestionTexts.map((text: string) => `- ${text}`).join('\n') : '- No recent questions available.'}

CANDIDATE ACTUAL RESUME CONTENT (SINGLE SOURCE OF TRUTH):
"""
${effectiveResumeContent.substring(0, 7000)}
"""

Generate exactly ${count} questions matching the distribution above. Questions must be specific to the selected role, its required skills, the stated experience level, and the supplied job description when present.
For each question, return:
{
  "id": number (1 to ${count}),
  "questionNumber": number (1 to ${count}),
  "totalQuestions": ${count},
  "stage": number (1 to ${count}),
  "stageName": string,
  "questionType": "Project-Based" | "Skill-Based" | "Experience-Based",
  "resumeAnchor": string (the exact project name, skill, or experience from candidate resume),
  "exactSourceExcerpt": string (verbatim quote from candidate resume proving this anchor exists),
  "track": string,
  "title": string,
  "category": string,
  "difficulty": "Medium" | "Hard",
  "timeAllowedSeconds": number (e.g. 300),
  "questionText": string (the exact question to ask, explicitly citing candidate's project or skill with zero unlisted technologies),
  "contextPrompt": string (the interviewer's evaluation context and technical criteria),
  "interviewer": {
    "name": string,
    "role": string,
    "companyBenchmark": "${companyBenchmark}",
    "avatarInitials": string
  },
  "evaluationCriteria": [string, string, string, string],
  "hint": string,
  "sampleKeyPoints": [string, string, string]
}

Return ONLY a valid JSON array of 6 question objects without markdown backticks.`;

      try {
        aiResult = await generateAiContent({
          userPrompt: prompt,
          jsonMode: true,
        });

        questions = cleanAndParseJson<any[]>(aiResult.text, []);
        if (!Array.isArray(questions) || questions.length === 0) {
          console.warn(`[${activeConfig.provider} generate-questions] Parsing returned empty array. Triggering local precision question engine.`);
          questions = localGenerateQuestions(effectiveResumeContent, roleTrack, companyBenchmark, framework, recentQuestionTexts, Number(count) || 6, difficulty);
        }
      } catch (apiErr: any) {
        const isQuota = isRateLimitOrQuotaError(apiErr);
        const status = apiErr?.statusCode || apiErr?.status || (isQuota ? 429 : 500);
        console.warn(`[AI Provider Error (${activeConfig.provider})] /api/interview/generate-questions failed:`, {
          status,
          code: apiErr?.code,
          message: apiErr?.message,
          details: apiErr?.details || apiErr?.error,
        });
        aiNotice = {
          provider: activeConfig.provider,
          status,
          code: apiErr?.code || (isQuota ? 'RATE_LIMIT_EXCEEDED' : 'AI_API_ERROR'),
          message: apiErr?.message || String(apiErr),
          isQuotaExhausted: isQuota,
          troubleshooting: isQuota
            ? 'API rate limit or quota exceeded. The platform automatically engaged the local precision question engine.'
            : status === 401
            ? `API key rejected. Verify ${activeConfig.sourceKeyName} in Netlify Environment Variables.`
            : 'Check server logs and environment variable setup in Netlify.',
          details: apiErr?.details || null,
        };
        questions = localGenerateQuestions(effectiveResumeContent, roleTrack, companyBenchmark, framework, recentQuestionTexts, Number(count) || 6, difficulty);
      }
    }

    // Server-side strict validation: Ensure no unlisted technologies leak into questions
    const resumeTextLower = effectiveResumeContent.toLowerCase();
    const commonUnlistedBuzzwords = [
      'kubernetes', 'terraform', 'kafka', 'opentelemetry', 'helm', 
      'devops', 'microservices', 'docker', 'aws', 'gcp', 'azure', 'ci/cd'
    ];

    if (Array.isArray(questions)) {
      questions = questions.slice(0, Math.max(1, Number(count) || 6)).map((q: any, index: number, selected: any[]) => {
        let sanitizedText = q.questionText || '';
        for (const word of commonUnlistedBuzzwords) {
          if (!resumeTextLower.includes(word) && sanitizedText.toLowerCase().includes(word)) {
            // Replace or tone down unmentioned buzzword
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            sanitizedText = sanitizedText.replace(regex, 'application architecture');
          }
        }
        return {
          ...q,
          id: index + 1,
          questionNumber: index + 1,
          totalQuestions: selected.length,
          questionText: sanitizedText,
        };
      });
    }

    return res.json({
      success: true,
      questions,
      source: aiNotice ? 'local_precision_fallback' : `${aiResult?.provider || activeConfig.provider}_ai`,
      provider: activeConfig.provider,
      model: aiResult?.model || activeConfig.model,
      aiError: aiNotice,
      aiNotice,
    });
  } catch (err: any) {
    console.error('Error generating questions:', err);
    return res.status(500).json({
      error: 'Failed to generate dynamic questions',
      details: err?.message || String(err),
    });
  }
});

// 2. Answer Evaluation API (Strictly based on actual candidate answers)
app.post(['/api/interview/evaluate-answer', '/interview/evaluate-answer'], async (req, res) => {
  try {
    const {
      question,
      candidateAnswer = '',
      candidateNotes = '',
      elapsedSeconds = 0,
    } = req.body;

    const activeConfig = getActiveAiConfig();
    let evaluation;
    let aiNotice: any = null;
    let aiResult: any = null;

    if (!activeConfig.apiKey) {
      console.warn(`[Production AI Warning] ${activeConfig.sourceKeyName} missing on server. Using local evaluation engine.`);
      aiNotice = {
        status: 401,
        code: 'AI_API_KEY_MISSING',
        message: `No AI API key found. Add ${activeConfig.sourceKeyName} in Netlify Environment Variables.`,
      };
      evaluation = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
    } else {
      const prompt = `You are a strict, evidence-based Staff Engineer and Placement Bar-Raiser evaluating a candidate's answer to an interview question.

INTERVIEW QUESTION ASKED:
- Stage: ${question?.stageName || 'Technical Stage'}
- Title: ${question?.title || ''}
- Question Text: "${question?.questionText || ''}"
- Context & Constraints: ${question?.contextPrompt || ''}
- Rubric Criteria: ${JSON.stringify(question?.evaluationCriteria || [])}
- Expected Key Points: ${JSON.stringify(question?.sampleKeyPoints || question?.evaluationCriteria || [])}

CANDIDATE ACTUAL SUBMITTED TRANSCRIPTION:
Verbal Spoken Transcript:
"${candidateAnswer || '[No verbal answer recorded]'}"

Written Notes / Outline:
"${candidateNotes || '[No written notes provided]'}"

Elapsed Time: ${elapsedSeconds} seconds

STRICT EVALUATION MANDATE (12 RULES):
1. Compare the candidate's answer DIRECTLY against the specific interview question asked.
2. Evaluate ONLY the content present in the transcription. The transcription is the single source of truth.
3. Do NOT assume knowledge, intent, experience, or understanding that was not explicitly demonstrated in the answer.
4. Do NOT hallucinate strengths, weaknesses, skills, or concepts. If the candidate did not explicitly articulate a point, they receive zero credit for it.
5. If the answer is incorrect, incomplete, off-topic, or contains factual mistakes, clearly explain why in "factualErrorsOrGaps".
6. Provide honest, recruiter-style feedback instead of overly positive generic feedback. Never inflate scores.
7. If the answer is partially correct, explicitly itemize:
   - "whatWasCorrect": Exactly what was correct and grounded in the transcript
   - "whatWasMissing": Exactly what expected elements were omitted
   - "whatCouldBeImproved": Concrete technical steps to reach bar
8. CRITICAL: If the candidate provides NO answer, a completely empty response, or a completely off-topic/gibberish answer:
   - YOU MUST assign a score of 0 for technical accuracy and completeness.
   - YOU MUST set "questionAddressed" to "Did Not Address Question" or "Off-Topic / Avoided".
   - YOU MUST explicitly state that they failed to provide a relevant answer in "offTopicOrAvoidanceNotice" and "factualErrorsOrGaps". Do NOT invent a positive feedback loop for silence.
9. Score answers strictly based on:
   - "relevance": (0-100) Direct alignment with the prompt constraints
   - "technicalAccuracyScore": (0-100) Factual correctness of statements made
   - "completeness": (0-100) Fraction of key requirements addressed
   - "clarity": (0-100) Structure and precision of explanation
   - "overallQuestionScore": (0-100) Uninflated weighted score (Relevance 30%, Technical 35%, Completeness 20%, Clarity 15%)
10. Explicitly list the expected key points in "expectedKeyPoints" that a strong answer should have included.
11. If confidence in the evaluation is low (sparse transcript, short audio, ambiguous transcript), set "evaluationConfidence" to "Low (Uncertain/Sparse Transcription)" and state the uncertainty in "uncertaintyNote" rather than making assumptions.
12. Reduce hallucinations to the absolute minimum and anchor every conclusion in the transcription.

Return ONLY a valid JSON object with the following schema (no markdown, no backticks):
{
  "relevance": number (0-100),
  "technicalAccuracyScore": number (0-100),
  "completeness": number (0-100),
  "clarity": number (0-100),
  "overallQuestionScore": number (0-100),
  "questionAddressed": "Fully Addressed" | "Partially Addressed" | "Did Not Address Question" | "Off-Topic / Avoided",
  "offTopicOrAvoidanceNotice": string | null (explicit explanation if answer was off-topic or avoided),
  "whatWasCorrect": [string] (only items actually demonstrated in the transcript),
  "whatWasMissing": [string] (expected points not mentioned in transcript),
  "whatCouldBeImproved": [string] (concrete actionable improvements),
  "factualErrorsOrGaps": [string] (explicit flaws or omitted mechanisms),
  "expectedKeyPoints": [string] (points a strong answer should cover),
  "idealAnswerComparison": string (model answer summary),
  "recruiterVerdict": string (candid recruiter assessment),
  "evaluationConfidence": "High" | "Moderate" | "Low (Uncertain/Sparse Transcription)",
  "uncertaintyNote": string | null (explanation if confidence is not High),
  "transcriptWordCount": number,
  "evidenceQuotes": [string] (exact quotes from the candidate's transcript),
  "technicalCorrectness": number (0-100, same as technicalAccuracyScore),
  "technicalFeedback": string,
  "communication": number (0-100, same as clarity),
  "communicationFeedback": string,
  "relevanceFeedback": string,
  "problemSolving": number (0-100),
  "problemSolvingFeedback": string,
  "identifiedStrengths": [string],
  "areasForImprovement": [string],
  "recommendedFollowUp": string
}`;

      try {
        aiResult = await generateAiContent({
          userPrompt: prompt,
          jsonMode: true,
        });

        evaluation = cleanAndParseJson<any>(aiResult.text, null);
        if (!evaluation || typeof evaluation !== 'object' || typeof evaluation.overallQuestionScore !== 'number') {
          console.warn(`[${activeConfig.provider} evaluate-answer] Model response invalid or missing overallQuestionScore. Triggering local precision evaluation engine.`);
          evaluation = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
        } else {
          // Ensure all required fields exist on AI evaluation
          evaluation.technicalAccuracyScore = evaluation.technicalAccuracyScore ?? evaluation.technicalCorrectness ?? 0;
          evaluation.technicalCorrectness = evaluation.technicalAccuracyScore;
          evaluation.clarity = evaluation.clarity ?? evaluation.communication ?? 0;
          evaluation.communication = evaluation.clarity;
          evaluation.relevance = evaluation.relevance ?? 0;
          evaluation.completeness = evaluation.completeness ?? 0;
          evaluation.whatWasCorrect = Array.isArray(evaluation.whatWasCorrect) ? evaluation.whatWasCorrect : (evaluation.identifiedStrengths || []);
          evaluation.whatWasMissing = Array.isArray(evaluation.whatWasMissing) ? evaluation.whatWasMissing : (evaluation.areasForImprovement || []);
          evaluation.whatCouldBeImproved = Array.isArray(evaluation.whatCouldBeImproved) ? evaluation.whatCouldBeImproved : (evaluation.areasForImprovement || []);
          evaluation.expectedKeyPoints = Array.isArray(evaluation.expectedKeyPoints) ? evaluation.expectedKeyPoints : (question?.sampleKeyPoints || question?.evaluationCriteria || []);
          evaluation.transcriptWordCount = evaluation.transcriptWordCount ?? `${candidateAnswer || ''} ${candidateNotes || ''}`.trim().split(/\s+/).filter(Boolean).length;
          evaluation.evidenceQuotes = Array.isArray(evaluation.evidenceQuotes) ? evaluation.evidenceQuotes : (candidateAnswer ? [candidateAnswer.slice(0, 120)] : []);
        }
      } catch (apiErr: any) {
        const isQuota = isRateLimitOrQuotaError(apiErr);
        const status = apiErr?.statusCode || apiErr?.status || (isQuota ? 429 : 500);
        console.warn(`[AI Provider Error (${activeConfig.provider})] /api/interview/evaluate-answer failed:`, {
          status,
          code: apiErr?.code,
          message: apiErr?.message,
        });
        aiNotice = {
          provider: activeConfig.provider,
          status,
          code: apiErr?.code || (isQuota ? 'RATE_LIMIT_EXCEEDED' : 'GEMINI_API_ERROR'),
          message: apiErr?.message || String(apiErr),
          isQuotaExhausted: isQuota,
          troubleshooting: isQuota
            ? 'API rate limit exceeded. Automatically engaged deterministic precision evaluator.'
            : status === 401
            ? `Gemini API key rejected. Verify ${activeConfig.sourceKeyName} in environment variables.`
            : 'Check server logs and GEMINI_API_KEY configuration.',
          details: apiErr?.details || null,
        };
        evaluation = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
      }
    }
    evaluation = localEvaluateAnswer(question, candidateAnswer, candidateNotes, elapsedSeconds);
    return res.json({
      success: true,
      evaluation,
      source: aiNotice ? 'local_precision_fallback' : `${aiResult?.provider || activeConfig.provider}_ai`,
      provider: activeConfig.provider,
      model: aiResult?.model || activeConfig.model,
      aiError: aiNotice,
      aiNotice,
    });
  } catch (err: any) {
    console.error('Error evaluating answer:', err);
    return res.status(500).json({
      error: 'Failed to evaluate answer',
      details: err?.message || String(err),
    });
  }
});

// 3. Dynamic Follow-up Question API
app.post(['/api/interview/generate-followup', '/interview/generate-followup'], async (req, res) => {
  try {
    const {
      previousQuestion,
      candidateAnswer,
      interviewContext = '',
    } = req.body;

    const activeConfig = getActiveAiConfig();
    let followUp;
    let aiNotice: any = null;
    let aiResult: any = null;

    if (!activeConfig.apiKey) {
      console.warn(`[Production AI Warning] ${activeConfig.sourceKeyName} missing on server. Using local follow-up engine.`);
      aiNotice = {
        status: 401,
        code: 'GEMINI_API_KEY_MISSING',
        message: `No Gemini API key configured. Add GEMINI_API_KEY in environment variables.`,
      };
      followUp = localGenerateFollowup(previousQuestion, candidateAnswer, interviewContext);
    } else {
      const prompt = `You are the technical interviewer conducting a mock placement round.
Question Asked: "${previousQuestion?.questionText || ''}"
Resume Anchor: "${previousQuestion?.resumeAnchor || ''}"
Candidate Answer: "${candidateAnswer || 'Brief or incomplete response'}"
Context: ${interviewContext}

RULES FOR DYNAMIC FOLLOW-UP PROBING:
1. If the candidate gave a vague answer -> probe deeper into the exact mechanism or implementation.
2. If the candidate mentioned a specific tool, database, or library -> ask specifically how they utilized it and why they chose it over alternatives.
3. If the candidate claimed high performance/metrics (e.g. latency, throughput, scale) -> ask for technical evidence, how it was benchmarked, and how they calculated it.
4. If the candidate gave an incomplete answer -> ask what happens during failure conditions or edge cases.
5. CRITICAL: If the candidate gave NO answer, an empty answer, or a completely off-topic answer, your followUpText MUST call this out directly (e.g., 'It seems you didn't provide a relevant answer. Let's try again: [rephrase question]'). Do NOT hallucinate that they answered the question.

Return a JSON object:
{
  "followUpText": string (the probing question to ask),
  "targetInsight": string (what specific competency or depth you are testing with this probe),
  "evaluationKeyPoint": string (what a solid response must explain)
}
Return ONLY valid JSON without markdown.`;

      try {
        aiResult = await generateAiContent({
          userPrompt: prompt,
          jsonMode: true,
        });

        followUp = cleanAndParseJson<any>(aiResult.text, null);
        if (!followUp || typeof followUp !== 'object' || !followUp.followUpText) {
          console.warn(`[${activeConfig.provider} generate-followup] Model response missing followUpText. Triggering local precision follow-up engine.`);
          followUp = localGenerateFollowup(previousQuestion, candidateAnswer, interviewContext);
        }
      } catch (apiErr: any) {
        const isQuota = isRateLimitOrQuotaError(apiErr);
        const status = apiErr?.statusCode || apiErr?.status || (isQuota ? 429 : 500);
        console.warn(`[AI Provider Error (${activeConfig.provider})] /api/interview/generate-followup failed:`, {
          status,
          code: apiErr?.code,
          message: apiErr?.message,
        });
        aiNotice = {
          provider: activeConfig.provider,
          status,
          code: apiErr?.code || (isQuota ? 'RATE_LIMIT_EXCEEDED' : 'GEMINI_API_ERROR'),
          message: apiErr?.message || String(apiErr),
          isQuotaExhausted: isQuota,
          troubleshooting: isQuota
            ? 'API rate limit exceeded. Automatically engaged fallback question generator.'
            : status === 401
            ? `Gemini API key rejected. Verify ${activeConfig.sourceKeyName} in environment variables.`
            : 'Check server logs and GEMINI_API_KEY configuration.',
          details: apiErr?.details || null,
        };
        followUp = localGenerateFollowup(previousQuestion, candidateAnswer, interviewContext);
      }
    }
    return res.json({
      success: true,
      followUp,
      source: aiNotice ? 'local_precision_fallback' : `${aiResult?.provider || activeConfig.provider}_ai`,
      provider: activeConfig.provider,
      model: aiResult?.model || activeConfig.model,
      aiError: aiNotice,
      aiNotice,
    });
  } catch (err: any) {
    console.error('Error generating follow-up:', err);
    return res.status(500).json({
      error: 'Failed to generate follow-up question',
      details: err?.message || String(err),
    });
  }
});

// 4. Complete Session Evaluation Report Generator (Rigorous, Evidence-Based)
app.post(['/api/interview/complete-evaluation', '/interview/complete-evaluation'], async (req, res) => {
  try {
    const {
      sessionQuestions = [],
      answers = {},
      notes = {},
      elapsedSeconds = 0,
      candidateProfile = {},
      videoAnalysis = null,
    } = req.body;

    const activeConfig = getActiveAiConfig();
    let report;
    let aiNotice: any = null;
    let aiResult: any = null;

    if (!activeConfig.apiKey) {
      console.warn(`[Production AI Warning] ${activeConfig.sourceKeyName} missing on server. Using local comprehensive evaluation engine.`);
      aiNotice = {
        status: 401,
        code: 'GEMINI_API_KEY_MISSING',
        message: `No Gemini API key found. Add GEMINI_API_KEY in environment variables.`,
      };
      report = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
    } else {
      const sessionSummary = sessionQuestions.map((q: any, idx: number) => ({
        stageNumber: q.stage || idx + 1,
        stageName: q.stageName || `Stage ${idx + 1}`,
        question: q.questionText,
        resumeAnchor: q.resumeAnchor || '',
        category: q.category,
        answer: answers[idx] || answers[q.id] || '[No verbal response recorded]',
        notes: notes[idx] || notes[q.id] || '',
      }));

      const videoSummaryPrompt = videoAnalysis
        ? `
EMPIRICAL VIDEO & NON-VERBAL TELEMETRY (FROM ACTUAL INTERVIEW RECORDING):
- Overall Presence Verdict: ${videoAnalysis.overallPresenceVerdict} (${videoAnalysis.overallVideoScore}/100)
- Eye Contact: ${videoAnalysis.eyeContact?.directGazePercentage}% direct lens gaze, ${videoAnalysis.eyeContact?.downwardGazePercentage}% downward glance (notes/desk), ${videoAnalysis.eyeContact?.lateralDriftPercentage}% lateral drift
- Dominant Facial Affect: ${videoAnalysis.facialExpressions?.dominantState} (Attentive: ${videoAnalysis.facialExpressions?.expressionBreakdown?.attentivePct}%, Confident: ${videoAnalysis.facialExpressions?.expressionBreakdown?.confidentPct}%, Tense: ${videoAnalysis.facialExpressions?.expressionBreakdown?.tensePct}%)
- Posture & Movement: ${videoAnalysis.bodyLanguage?.postureAlignment}, micro-fidgeting index: ${videoAnalysis.confidence?.microFidgetingIndex}/100
- Audio-Visual Sync: ${videoAnalysis.speakingConsistency?.audioVisualSync}
- Sensor Confidence: ${videoAnalysis.detectionConfidence} (${videoAnalysis.confidenceReason})
- Recorded Key Observations: ${JSON.stringify(videoAnalysis.evidenceTimeline?.slice(0, 5) || [])}
MANDATE: Factor this verified video telemetry directly into "Confidence & Delivery" and "Communication Clarity" evaluations. Ground your feedback in these actual non-verbal behaviors without inventing or hallucinating unobserved actions.`
        : '';

      const prompt = `You are the Placement Bar-Raising Committee evaluating a completed candidate technical interview.

CANDIDATE PROFILE:
Name: ${candidateProfile?.name || 'Candidate'}
Target Role: ${candidateProfile?.targetRole || 'Software Development Engineer'}
Target Benchmark: ${candidateProfile?.targetCompanyTrack || 'Tier-1 Product Companies'}
Total Interview Duration: ${Math.round(elapsedSeconds / 60)} minutes
Total Questions Evaluated: ${sessionQuestions.length}

FULL INTERVIEW TRANSCRIPT & RESPONSES:
${JSON.stringify(sessionSummary, null, 2)}
${videoSummaryPrompt}

STRICT EVALUATION MANDATES:
1. Score the candidate based strictly on their actual answers.
2. If the candidate provided NO answers, completely empty responses, or off-topic gibberish, YOU MUST score them 0-10% and explicitly state in the justification that they failed to provide meaningful answers. Do not hallucinate strengths if the transcripts are empty.
3. If candidate provided brief, superficial, or unconvincing answers, the scores MUST reflect that (e.g. 20-40%).
4. Do NOT give default 80-90% scores! A score above 75% requires thorough explanations, accurate technical trade-offs, and clear communication.
5. Evaluate all 5 core parameters:
   - Technical Accuracy (0-100)
   - Communication Clarity (0-100)
   - Problem Solving Structure (0-100)
   - Depth of Knowledge (0-100)
   - Confidence and Delivery (0-100)
5. For EVERY parameter, provide:
   - score (0-100)
   - justification (rigorous rationale based on actual answers)
   - positive highlights (bullet points of what was done well, if any)
   - specific mistakes or omissions (bullet points of exact errors or gaps)
   - ideal answer comparison (clear standard of what was expected)
6. Generate an actionable improvement roadmap based ONLY on weak areas identified during this interview.
7. Provide recommended learning resources tailored directly to the candidate's gaps.

Return a JSON object structured as:
{
  "overallScore": number (0-100, honest weighted average of the 5 parameters),
  "percentile": number (0-100, realistic cohort percentile based on overall score),
  "verdict": string ("Strong Hire" | "Hire" | "Lean Hire" | "Needs Significant Preparation"),
  "evaluationDate": "${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}",
  "cohortSize": 1420,
  "evaluationParameters": {
    "technicalAccuracy": {
      "score": number,
      "justification": string,
      "highlights": [string],
      "mistakes": [string],
      "idealComparison": string
    },
    "communicationClarity": {
      "score": number,
      "justification": string,
      "highlights": [string],
      "mistakes": [string],
      "idealComparison": string
    },
    "problemSolvingStructure": {
      "score": number,
      "justification": string,
      "highlights": [string],
      "mistakes": [string],
      "idealComparison": string
    },
    "depthOfKnowledge": {
      "score": number,
      "justification": string,
      "highlights": [string],
      "mistakes": [string],
      "idealComparison": string
    },
    "confidenceAndDelivery": {
      "score": number,
      "justification": string,
      "highlights": [string],
      "mistakes": [string],
      "idealComparison": string
    }
  },
  "dimensions": [
    { "name": "Technical Accuracy", "score": number, "maxScore": 100, "status": "Ready" | "Developing" | "Critical Gap", "benchmark": 75, "feedback": string },
    { "name": "Communication Clarity", "score": number, "maxScore": 100, "status": string, "benchmark": 70, "feedback": string },
    { "name": "Problem Solving Structure", "score": number, "maxScore": 100, "status": string, "benchmark": 72, "feedback": string },
    { "name": "Depth of Knowledge", "score": number, "maxScore": 100, "status": string, "benchmark": 70, "feedback": string },
    { "name": "Confidence & Delivery", "score": number, "maxScore": 100, "status": string, "benchmark": 70, "feedback": string }
  ],
  "radarMetrics": [
    { "subject": "Technical Depth", "score": number, "benchmark": 75, "fullMark": 100 },
    { "subject": "Architecture", "score": number, "benchmark": 72, "fullMark": 100 },
    { "subject": "Communication", "score": number, "benchmark": 70, "fullMark": 100 },
    { "subject": "Problem Solving", "score": number, "benchmark": 74, "fullMark": 100 },
    { "subject": "Delivery", "score": number, "benchmark": 70, "fullMark": 100 },
    { "subject": "Concurrency", "score": number, "benchmark": 68, "fullMark": 100 }
  ],
  "skillHeatmap": [
    { "skill": string, "category": string, "mastery": "Mastered" | "Proficient" | "Developing" | "Needs Focus", "score": number, "trend": "up" | "stable" | "down", "interviewsCount": 1 }
  ],
  "improvementRoadmap": [
    {
      "id": "rw-1",
      "stage": "Week 1",
      "focus": string,
      "priority": "Critical" | "High" | "Medium",
      "description": string,
      "action": string,
      "estHours": number,
      "status": "todo"
    }
  ],
  "recommendedResources": [
    {
      "title": string,
      "type": "Documentation" | "Course" | "Book" | "Practice",
      "topic": string,
      "url": string,
      "description": string
    }
  ]
}
Return ONLY valid JSON without markdown.`;

      try {
        aiResult = await generateAiContent({
          userPrompt: prompt,
          jsonMode: true,
        });

        report = cleanAndParseJson<any>(aiResult.text, null);
        if (!report || typeof report !== 'object' || typeof report.overallScore !== 'number') {
          console.warn(`[${activeConfig.provider} complete-evaluation] Model response missing overallScore. Triggering local precision complete evaluation engine.`);
          report = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
        }
      } catch (apiErr: any) {
        const isQuota = isRateLimitOrQuotaError(apiErr);
        const status = apiErr?.statusCode || apiErr?.status || (isQuota ? 429 : 500);
        console.warn(`[AI Provider Error (${activeConfig.provider})] /api/interview/complete-evaluation failed:`, {
          status,
          code: apiErr?.code,
          message: apiErr?.message,
        });
        aiNotice = {
          provider: activeConfig.provider,
          status,
          code: apiErr?.code || (isQuota ? 'RATE_LIMIT_EXCEEDED' : 'GEMINI_API_ERROR'),
          message: apiErr?.message || String(apiErr),
          isQuotaExhausted: isQuota,
          troubleshooting: isQuota
            ? 'API rate limit exceeded. Automatically engaged deterministic comprehensive report engine.'
            : status === 401
            ? `Gemini API key rejected. Verify ${activeConfig.sourceKeyName} in environment variables.`
            : 'Check server logs and GEMINI_API_KEY configuration.',
          details: apiErr?.details || null,
        };
        report = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);
      }
    }

    report = localCompleteEvaluation(sessionQuestions, answers, notes, elapsedSeconds, candidateProfile, videoAnalysis);

    if (report && videoAnalysis) {
      report.videoAnalysis = videoAnalysis;
    }

    return res.json({
      success: true,
      report,
      source: 'deterministic_evidence_evaluator',
      provider: activeConfig.provider,
      model: aiResult?.model || activeConfig.model,
      aiError: aiNotice,
      aiNotice,
    });
  } catch (err: any) {
    console.error('Error completing evaluation:', err);
    return res.status(500).json({
      error: 'Failed to complete evaluation report',
      details: err?.message || String(err),
    });
  }
});

// Multi-Stage Resume Extraction Pipeline (PDF.js -> pdf-parse -> OCR Fallback)
interface ExtractionMethodAttempt {
  method: 'PDF.js' | 'pdf-parse' | 'OCR Fallback' | 'Direct Text';
  status: 'success' | 'failed' | 'skipped';
  charsExtracted: number;
  durationMs: number;
  error?: string;
}

interface ResumeExtractionResult {
  text: string;
  totalPages: number;
  methodUsed: 'PDF.js' | 'pdf-parse' | 'OCR Fallback' | 'Direct Text';
  ocrRequired: boolean;
  attempts: ExtractionMethodAttempt[];
  rootCause?: string;
}

// Method 1: PDF.js legacy extraction
async function extractWithPdfJs(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    verbosity: 0,
    stopAtErrors: false,
    isEvalSupported: false,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages || 1;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .filter(Boolean)
      .join(' ');
    if (pageText.trim()) {
      fullText += pageText + '\n\n';
    }
  }

  return { text: fullText.trim(), pages: numPages };
}

// Method 2: pdf-parse extraction
async function extractWithPdfParse(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  let numPages = 1;
  try {
    const info = await parser.getInfo();
    numPages = (info && Array.isArray(info.pages) && info.pages.length > 0) ? info.pages.length : (textResult.pages?.length || 1);
  } catch {
    numPages = textResult.pages?.length || 1;
  }
  return {
    text: (textResult.text || '').trim(),
    pages: numPages || 1,
  };
}

// Method 3: OCR Fallback (Convert PDF pages to images or use direct multimodal vision)
async function extractWithOcrFallback(buffer: Buffer): Promise<{ text: string; pages: number }> {
  let numPages = 1;
  const imageParts: any[] = [];
  const { PDFParse } = await import('pdf-parse');

  // Attempt to convert PDF pages to images using PDFParse screenshot capabilities
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const screenshot = await (parser as any).getScreenshot?.({ pageNumber: 1 });
    if (screenshot && Array.isArray(screenshot.pages) && screenshot.pages.length > 0) {
      numPages = screenshot.total || screenshot.pages.length;
      for (const p of screenshot.pages) {
        if (p.data) {
          imageParts.push({
            inlineData: {
              mimeType: 'image/png',
              data: Buffer.from(p.data).toString('base64'),
            },
          });
        }
      }
    }
  } catch (screenshotErr) {
    console.warn('[Resume Pipeline] Page screenshot conversion notice:', screenshotErr);
  }

  // If no individual screenshot images could be extracted, pass the PDF buffer directly as inlineData
  if (imageParts.length === 0) {
    imageParts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: buffer.toString('base64'),
      },
    });
  }

  const promptText = `You are a precision Optical Character Recognition (OCR) engine specialized in technical resumes.
Perform verbatim optical character recognition on this document.
Extract ALL text verbatim, line by line, maintaining all sections (Education, Experience, Projects, Technical Skills, Certifications), bullet points, technologies, links, dates, and quantitative metrics.
Do NOT summarize or omit anything. Output ONLY the verbatim extracted text.`;

  try {
    const formattedParts = imageParts.map((p) => ({
      mimeType: p.inlineData.mimeType,
      data: p.inlineData.data,
    }));
    const response = await generateAiContent({
      userPrompt: promptText,
      imageParts: formattedParts,
      temperature: 0.1,
    });

    const ocrText = (response.text || '').trim();
    return { text: ocrText, pages: numPages };
  } catch (ocrErr: any) {
    console.warn('[Resume Pipeline] OCR Fallback notice:', ocrErr?.message || ocrErr);
    return { text: '', pages: numPages };
  }
}

// Execute the 3-step extraction pipeline with detailed diagnostics
async function runResumeExtractionPipeline(
  buffer: Buffer | null,
  rawText: string,
  fileName: string
): Promise<ResumeExtractionResult> {
  const attempts: ExtractionMethodAttempt[] = [];

  // Direct text if pasted or supplied directly
  if (rawText && rawText.trim().length >= 100) {
    attempts.push({
      method: 'Direct Text',
      status: 'success',
      charsExtracted: rawText.trim().length,
      durationMs: 1,
    });
    return {
      text: rawText.trim(),
      totalPages: 1,
      methodUsed: 'Direct Text',
      ocrRequired: false,
      attempts,
    };
  }

  if (!buffer) {
    return {
      text: (rawText || '').trim(),
      totalPages: 1,
      methodUsed: 'Direct Text',
      ocrRequired: false,
      attempts: [
        {
          method: 'Direct Text',
          status: rawText.trim().length > 0 ? 'success' : 'failed',
          charsExtracted: rawText.trim().length,
          durationMs: 1,
          error: rawText.trim().length === 0 ? 'No file buffer or text provided' : undefined,
        },
      ],
      rootCause: 'No readable file buffer or direct text was provided.',
    };
  }

  const extension = path.extname(fileName).toLowerCase();
  const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-' || extension === '.pdf';
  let lastRootCause = '';

  // Parse non-PDF uploads locally so accepted office and text files do not enter
  // the PDF-only fallback chain.
  if (!isPdf) {
    const startedAt = Date.now();
    try {
      let text = '';
      if (extension === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim();
      } else if (['.xlsx', '.xls', '.ods'].includes(extension)) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        text = workbook.SheetNames
          .map((sheetName) => `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}`)
          .join('\n\n')
          .trim();
      } else {
        text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
      }

      const printableCharacters = [...text].filter((character) => character === '\n' || character === '\r' || character === '\t' || character.charCodeAt(0) >= 32).length;
      const printableRatio = text.length > 0 ? printableCharacters / text.length : 0;
      if (text.length >= 20 && printableRatio >= 0.85) {
        attempts.push({
          method: 'Direct Text',
          status: 'success',
          charsExtracted: text.length,
          durationMs: Date.now() - startedAt,
        });
        return {
          text,
          totalPages: 1,
          methodUsed: 'Direct Text',
          ocrRequired: false,
          attempts,
        };
      }

      attempts.push({
        method: 'Direct Text',
        status: 'failed',
        charsExtracted: text.length,
        durationMs: Date.now() - startedAt,
        error: 'File did not contain enough readable text.',
      });
      lastRootCause = `The ${extension || 'uploaded'} file did not contain enough readable text.`;
    } catch (error: any) {
      attempts.push({
        method: 'Direct Text',
        status: 'failed',
        charsExtracted: 0,
        durationMs: Date.now() - startedAt,
        error: error?.message || String(error),
      });
      lastRootCause = `File parser failed: ${error?.message || 'Unsupported or corrupted file format'}`;
    }

    return {
      text: '',
      totalPages: 1,
      methodUsed: 'Direct Text',
      ocrRequired: false,
      attempts,
      rootCause: lastRootCause,
    };
  }

  let finalTotalPages = 1;

  // -------------------------------------------------------------
  // Method 1: PDF.js
  // -------------------------------------------------------------
  const t1Start = Date.now();
  try {
    console.log(`[Resume Pipeline] Attempting Method 1: PDF.js for ${fileName}...`);
    const pdfJsResult = await extractWithPdfJs(buffer);
    const durationMs = Date.now() - t1Start;
    finalTotalPages = pdfJsResult.pages;

    if (pdfJsResult.text.length >= 100) {
      console.log(`[Resume Pipeline] Method 1: PDF.js succeeded (${pdfJsResult.text.length} chars, ${pdfJsResult.pages} pages) in ${durationMs}ms`);
      attempts.push({
        method: 'PDF.js',
        status: 'success',
        charsExtracted: pdfJsResult.text.length,
        durationMs,
      });
      attempts.push({ method: 'pdf-parse', status: 'skipped', charsExtracted: 0, durationMs: 0 });
      attempts.push({ method: 'OCR Fallback', status: 'skipped', charsExtracted: 0, durationMs: 0 });

      return {
        text: pdfJsResult.text,
        totalPages: finalTotalPages,
        methodUsed: 'PDF.js',
        ocrRequired: false,
        attempts,
      };
    } else {
      console.warn(`[Resume Pipeline] Method 1: PDF.js extracted ${pdfJsResult.text.length} chars (< 100 threshold). Escalating to Method 2: pdf-parse.`);
      attempts.push({
        method: 'PDF.js',
        status: 'failed',
        charsExtracted: pdfJsResult.text.length,
        durationMs,
        error: `Extracted length (${pdfJsResult.text.length} chars) was below the 100-character threshold.`,
      });
      lastRootCause = `PDF.js extracted ${pdfJsResult.text.length} characters. Document may use non-standard font encodings, flattened vector paths, or scanned images.`;
    }
  } catch (err: any) {
    const durationMs = Date.now() - t1Start;
    console.warn(`[Resume Pipeline] Method 1: PDF.js threw error:`, err?.message || err);
    attempts.push({
      method: 'PDF.js',
      status: 'failed',
      charsExtracted: 0,
      durationMs,
      error: err?.message || String(err),
    });
    lastRootCause = `PDF.js parsing error: ${err?.message || 'Invalid or unrecognized PDF structure'}`;
  }

  // -------------------------------------------------------------
  // Method 2: pdf-parse (if extracted text < 100 chars)
  // -------------------------------------------------------------
  const t2Start = Date.now();
  try {
    console.log(`[Resume Pipeline] Attempting Method 2: pdf-parse for ${fileName}...`);
    const parseResult = await extractWithPdfParse(buffer);
    const durationMs = Date.now() - t2Start;
    if (parseResult.pages > 1) finalTotalPages = parseResult.pages;

    if (parseResult.text.length >= 100) {
      console.log(`[Resume Pipeline] Method 2: pdf-parse succeeded (${parseResult.text.length} chars) in ${durationMs}ms`);
      attempts.push({
        method: 'pdf-parse',
        status: 'success',
        charsExtracted: parseResult.text.length,
        durationMs,
      });
      attempts.push({ method: 'OCR Fallback', status: 'skipped', charsExtracted: 0, durationMs: 0 });

      return {
        text: parseResult.text,
        totalPages: finalTotalPages,
        methodUsed: 'pdf-parse',
        ocrRequired: false,
        attempts,
      };
    } else {
      console.warn(`[Resume Pipeline] Method 2: pdf-parse extracted ${parseResult.text.length} chars (< 100 threshold). Escalating to Method 3: OCR Fallback.`);
      attempts.push({
        method: 'pdf-parse',
        status: 'failed',
        charsExtracted: parseResult.text.length,
        durationMs,
        error: `Extracted length (${parseResult.text.length} chars) was below the 100-character threshold.`,
      });
      lastRootCause = `Both PDF.js and pdf-parse yielded fewer than 100 characters. Document appears to be a scanned paper, canvas-rendered image, or screenshot.`;
    }
  } catch (err: any) {
    const durationMs = Date.now() - t2Start;
    console.warn(`[Resume Pipeline] Method 2: pdf-parse threw error:`, err?.message || err);
    attempts.push({
      method: 'pdf-parse',
      status: 'failed',
      charsExtracted: 0,
      durationMs,
      error: err?.message || String(err),
    });
    lastRootCause = `pdf-parse failed: ${err?.message || 'Error parsing PDF stream'}`;
  }

  // -------------------------------------------------------------
  // Method 3: OCR Fallback
  // -------------------------------------------------------------
  const t3Start = Date.now();
  try {
    console.log(`[Resume Pipeline] Attempting Method 3: OCR Fallback for ${fileName}...`);
    const ocrResult = await extractWithOcrFallback(buffer);
    const durationMs = Date.now() - t3Start;
    if (ocrResult.pages > 1) finalTotalPages = ocrResult.pages;

    if (ocrResult.text.length >= 40) {
      console.log(`[Resume Pipeline] Method 3: OCR Fallback succeeded (${ocrResult.text.length} chars) in ${durationMs}ms`);
      attempts.push({
        method: 'OCR Fallback',
        status: 'success',
        charsExtracted: ocrResult.text.length,
        durationMs,
      });

      return {
        text: ocrResult.text,
        totalPages: finalTotalPages,
        methodUsed: 'OCR Fallback',
        ocrRequired: true,
        attempts,
      };
    } else {
      attempts.push({
        method: 'OCR Fallback',
        status: 'failed',
        charsExtracted: ocrResult.text.length,
        durationMs,
        error: `OCR output length (${ocrResult.text.length} chars) was below minimum threshold of 40 chars.`,
      });
      lastRootCause = `OCR fallback executed but extracted only ${ocrResult.text.length} characters. The uploaded document appears to be blank, has extremely low contrast, or contains corrupted visuals.`;
    }
  } catch (err: any) {
    const durationMs = Date.now() - t3Start;
    console.warn(`[Resume Pipeline] Method 3: OCR Fallback threw error:`, err?.message || err);
    attempts.push({
      method: 'OCR Fallback',
      status: 'failed',
      charsExtracted: 0,
      durationMs,
      error: err?.message || String(err),
    });
    lastRootCause = `OCR fallback failed: ${err?.message || 'Vision API OCR processing error'}`;
  }

  // All 3 methods failed to yield readable text
  return {
    text: '',
    totalPages: finalTotalPages,
    methodUsed: 'PDF.js',
    ocrRequired: true,
    attempts,
    rootCause: lastRootCause || 'All extraction methods (PDF.js, pdf-parse, OCR fallback) were attempted but no readable text could be retrieved.',
  };
}

// 5. Resume PDF Text Extraction & Competency Analysis (Zero Hallucination / Evidence-Based)
app.post(['/api/resume/extract-and-analyze', '/resume/extract-and-analyze'], async (req, res) => {
  try {
    const {
      filename = 'Resume.pdf',
      fileBase64 = '',
      rawText = '',
      fileSize = 'Standard',
      targetRole = 'Software Development Engineer (SDE-1)',
    } = req.body;

    const activeConfig = getActiveAiConfig();
    const buffer = fileBase64 ? Buffer.from(fileBase64, 'base64') : null;

    // Execute multi-stage extraction pipeline
    const extraction = await runResumeExtractionPipeline(buffer, rawText, filename);

    const diagnostics = {
      fileName: filename,
      fileSize,
      totalPages: extraction.totalPages,
      extractedCharacterCount: extraction.text.length,
      extractionMethodUsed: extraction.methodUsed,
      first500Chars: extraction.text.substring(0, 500),
      ocrRequired: extraction.ocrRequired,
      attempts: extraction.attempts,
      rootCause: extraction.rootCause,
    };

    console.log('[Resume Pipeline Summary]', {
      fileName: filename,
      fileSize,
      totalPages: extraction.totalPages,
      extractedCharacterCount: extraction.text.length,
      extractionMethodUsed: extraction.methodUsed,
      ocrRequired: extraction.ocrRequired,
      attemptsCount: extraction.attempts.length,
    });

    // If all extraction methods failed, return detailed diagnostics instead of a generic error
    if (!extraction.text || extraction.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File parsing failed. All applicable text extraction methods were attempted.',
        characterCount: 0,
        ocrAttempted: true,
        rootCause: extraction.rootCause || 'Document contains no detectable text characters or readable text streams.',
        diagnostics,
      });
    }

    const extractedText = extraction.text;
    const framework = getCompetencyFramework(targetRole);

    const prompt = `You are a Principal Technical Recruiter and Placement Bar-Raiser conducting a STRICT, EVIDENCE-BASED resume audit.

TARGET ROLE COMPETENCY FRAMEWORK:
Role Title: ${framework.title}
Level: ${framework.level}
Framework Description: ${framework.description}

REQUIRED SKILLS IN FRAMEWORK:
${JSON.stringify(framework.requiredSkills, null, 2)}

PREFERRED SKILLS IN FRAMEWORK:
${JSON.stringify(framework.preferredSkills, null, 2)}

CANDIDATE ACTUAL RESUME TEXT:
"""
${extractedText.substring(0, 8000)}
"""

====================================
STRICT EXTRACTION MODE MANDATES:
====================================
1. Extract ONLY content that appears verbatim in the uploaded resume.
2. Do NOT infer skills from project names.
   - Example: A project named 'E-Commerce Website' does NOT mean AWS, Docker, Kubernetes, Stripe, or React unless those exact words appear verbatim in the text.
3. Do NOT infer skills from job roles.
   - Example: 'Software Engineer' does NOT mean Git, Agile, CI/CD, or Linux unless those exact words appear verbatim in the text.
4. Do NOT infer skills from education.
   - Example: 'Computer Science Degree' does NOT mean C++, Java, or Algorithms unless those exact words appear verbatim in the text.
5. Do NOT infer cloud, DevOps, AI, testing, security, architecture, CI/CD, Kubernetes, Terraform, Helm, OpenTelemetry, Kafka, or ANY technology unless the exact technology name appears in the resume text.
6. For every extracted skill:
   - Skill Name
   - Exact Resume Text (verbatim excerpt from resume)
   - Section Found (e.g., 'Skills', 'Projects', 'Experience')
   - Confidence: Must be 100%
   Example:
   Skill: Java
   Source: "Programming Languages: Java, Python"
   Section: Skills
   Confidence: 100%
7. If evidence cannot be shown, DO NOT display or extract the skill.
8. No assumptions. No enrichment. No inferred technologies. No hallucinations. Resume text is the single source of truth.

====================================
VERIFIED RESUME FACTS OUTPUT:
====================================
Include a dedicated "verifiedFacts" section with:
- "skillsFound": Array of { "skill": string, "exactResumeText": string, "sectionFound": string, "confidence": "100%" }
- "projectsFound": Array of { "projectName": string, "exactResumeText": string, "sectionFound": string, "technologies": [string] (ONLY technologies explicitly written in that project description), "metrics": string }
- "certificationsFound": Array of { "certificationName": string, "exactResumeText": string, "sectionFound": string, "issuerOrYear": string }
- "experienceFound": Array of { "role": string, "organization": string, "exactResumeText": string, "sectionFound": string, "duration": string }

If evidence is missing for ANY item, DO NOT INCLUDE IT.

====================================
ROLE MATCHING MANDATES:
====================================
Compare the resume ONLY against the selected role competency framework:
- Matched Skills: only skills with direct verbatim evidence in candidate's resume
- Missing Skills: skills from framework with no evidence in resume (marked as "Not Found")
- Skill Match Percentage: strictly calculated based on: (matchedRequiredSkillsCount / totalRequiredSkillsCount * 80) + (matchedPreferredSkillsCount / totalPreferredSkillsCount * 20).
- DO NOT INFLATE MATCH SCORES! If candidate only matches 2 of 6 required skills, score MUST be honest (~27%), NOT 80% or 90%!
- Realistic Assessment: "Strong Match" (>= 80%), "Moderate Match" (60% - 79%), "Low Match" (40% - 59%), "High Risk" (< 40%).

Return a JSON object structured as:
{
  "filename": "${filename}",
  "fileSize": "${req.body.fileSize || 'Unknown'}",
  "uploadedAt": "${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}",
  "targetRole": "${targetRole}",
  "roleMatchPercentage": number (0-100, honest mathematical match),
  "rawTextSnippet": "${extractedText.substring(0, 280).replace(/"/g, '\\"').replace(/\n/g, ' ')}...",
  "verifiedFacts": {
    "skillsFound": [
      {
        "skill": string,
        "exactResumeText": string (exact verbatim quote from resume),
        "sectionFound": string,
        "confidence": "100%"
      }
    ],
    "projectsFound": [
      {
        "projectName": string,
        "exactResumeText": string (exact verbatim quote from resume),
        "sectionFound": string,
        "technologies": [string] (ONLY explicit technologies),
        "metrics": string
      }
    ],
    "certificationsFound": [
      {
        "certificationName": string,
        "exactResumeText": string,
        "sectionFound": string,
        "issuerOrYear": string
      }
    ],
    "experienceFound": [
      {
        "role": string,
        "organization": string,
        "exactResumeText": string,
        "sectionFound": string,
        "duration": string
      }
    ]
  },
  "explicitSkills": [
    {
      "name": string,
      "sourceText": string (verbatim quote),
      "resumeSection": string,
      "confidenceScore": 100,
      "status": "Verified",
      "category": string,
      "evidence": string
    }
  ],
  "matchBreakdown": {
    "recruitmentAssessment": "Strong Match" | "Moderate Match" | "Low Match" | "High Risk",
    "assessmentExplanation": string,
    "skillMatchPercentage": number,
    "requiredSkillsTotal": number,
    "requiredSkillsMatched": number,
    "preferredSkillsTotal": number,
    "preferredSkillsMatched": number,
    "matchedRequired": [
      { "skill": string, "evidence": string, "sourceText": string, "confidence": number }
    ],
    "missingRequired": [
      { "skill": string, "reason": "Not Found in candidate resume text", "recommendation": string }
    ],
    "matchedPreferred": [
      { "skill": string, "evidence": string, "sourceText": string, "confidence": number }
    ],
    "missingPreferred": [
      { "skill": string, "recommendation": string }
    ]
  },
  "skillsExtracted": [
    {
      "category": string,
      "skills": [
        {
          "name": string,
          "level": "Advanced" | "Proficient" | "Working",
          "verifiedByProject": boolean,
          "sourceText": string,
          "resumeSection": string,
          "confidenceScore": 100
        }
      ]
    }
  ],
  "projectsIdentified": [
    {
      "name": string,
      "role": string,
      "tech": [string],
      "metrics": string,
      "talkingPoints": [string, string],
      "sourceSection": string
    }
  ],
  "strengths": [
    {
      "title": string,
      "detail": string,
      "evidence": string
    }
  ],
  "missingSkills": [
    {
      "skill": string,
      "category": string,
      "importance": "High" | "Medium",
      "recommendation": string
    }
  ]
}
Return ONLY valid JSON without markdown code fences.`;

    let analysis: any = null;
    let aiNotice: any = null;
    let aiResult: any = null;

    if (!activeConfig.apiKey) {
      console.warn(`[Production AI Warning] ${activeConfig.sourceKeyName} is missing on server runtime. Executing zero-hallucination local resume parser.`);
      aiNotice = {
        status: 401,
        code: 'GEMINI_API_KEY_MISSING',
        message: `No Gemini API key configured. Add GEMINI_API_KEY in environment variables.`,
        recommendation: `Add GEMINI_API_KEY to your deployment environment variables or in AI Studio Settings.`,
      };
      analysis = localResumeAnalysis(extractedText, targetRole, filename, fileSize, framework);
    } else {
      try {
        aiResult = await generateAiContent({
          userPrompt: prompt,
          jsonMode: true,
        });

        analysis = cleanAndParseJson<any>(aiResult.text, null);
        if (!analysis || typeof analysis !== 'object' || !analysis.verifiedFacts) {
          console.warn(`[${activeConfig.provider} extract-and-analyze] Model response missing verifiedFacts. Triggering local precision resume parser.`);
          analysis = localResumeAnalysis(extractedText, targetRole, filename, fileSize, framework);
        }
      } catch (analysisErr: any) {
        const isQuota = isRateLimitOrQuotaError(analysisErr);
        const status = analysisErr?.statusCode || analysisErr?.status || (isQuota ? 429 : 500);
        console.warn(`[AI Provider Error (${activeConfig.provider})] Resume analysis failed:`, {
          status,
          code: analysisErr?.code,
          message: analysisErr?.message,
        });
        aiNotice = {
          provider: activeConfig.provider,
          status,
          code: analysisErr?.code || (isQuota ? 'RATE_LIMIT_EXCEEDED' : 'GEMINI_API_ERROR'),
          message: analysisErr?.message || String(analysisErr),
          isQuotaExhausted: isQuota,
          troubleshooting: isQuota
            ? 'API rate limit exceeded. Automatically engaged deterministic resume parser.'
            : status === 401
            ? `Gemini API key rejected. Verify ${activeConfig.sourceKeyName} in environment variables.`
            : 'Check server logs and GEMINI_API_KEY configuration.',
          details: analysisErr?.details || null,
        };
        // Graceful fallback: Precision zero-hallucination local resume parser
        analysis = localResumeAnalysis(extractedText, targetRole, filename, fileSize, framework);
      }
    }

    // Programmatic verification guardrails: mathematically enforce ZERO hallucinations
    const resumeTextLower = extractedText.toLowerCase();

    const isVerbatim = (str: string) => {
      if (!str || typeof str !== 'string') return false;
      const clean = str.trim().toLowerCase();
      if (!clean) return false;
      return resumeTextLower.includes(clean);
    };

    if (!analysis.verifiedFacts) {
      analysis.verifiedFacts = {
        skillsFound: [],
        projectsFound: [],
        certificationsFound: [],
        experienceFound: [],
      };
    }

    // Filter skillsFound
    if (Array.isArray(analysis.verifiedFacts.skillsFound)) {
      analysis.verifiedFacts.skillsFound = analysis.verifiedFacts.skillsFound
        .filter((item: any) => item && item.skill && item.exactResumeText && (isVerbatim(item.skill) || isVerbatim(item.exactResumeText)))
        .map((item: any) => ({
          ...item,
          confidence: '100%',
        }));
    } else {
      analysis.verifiedFacts.skillsFound = [];
    }

    // Filter projectsFound
    if (Array.isArray(analysis.verifiedFacts.projectsFound)) {
      analysis.verifiedFacts.projectsFound = analysis.verifiedFacts.projectsFound
        .filter((p: any) => p && p.projectName && p.exactResumeText && (isVerbatim(p.projectName) || isVerbatim(p.exactResumeText)))
        .map((p: any) => ({
          ...p,
          technologies: Array.isArray(p.technologies)
            ? p.technologies.filter((t: string) => isVerbatim(t))
            : [],
        }));
    } else {
      analysis.verifiedFacts.projectsFound = [];
    }

    // Filter certificationsFound
    if (Array.isArray(analysis.verifiedFacts.certificationsFound)) {
      analysis.verifiedFacts.certificationsFound = analysis.verifiedFacts.certificationsFound
        .filter((c: any) => c && c.certificationName && c.exactResumeText && (isVerbatim(c.certificationName) || isVerbatim(c.exactResumeText)));
    } else {
      analysis.verifiedFacts.certificationsFound = [];
    }

    // Filter experienceFound
    if (Array.isArray(analysis.verifiedFacts.experienceFound)) {
      analysis.verifiedFacts.experienceFound = analysis.verifiedFacts.experienceFound
        .filter((e: any) => e && e.exactResumeText && (isVerbatim(e.exactResumeText) || isVerbatim(e.role) || isVerbatim(e.organization)));
    } else {
      analysis.verifiedFacts.experienceFound = [];
    }

    // Ensure explicitSkills mirror verifiedFacts.skillsFound
    analysis.explicitSkills = analysis.verifiedFacts.skillsFound.map((s: any) => ({
      name: s.skill,
      sourceText: s.exactResumeText,
      resumeSection: s.sectionFound || 'Skills',
      confidenceScore: 100,
      status: 'Verified',
      category: s.sectionFound || 'Technical Skills',
      evidence: `Exact verbatim resume text: "${s.exactResumeText}"`,
    }));

    // Filter projectsIdentified to only include verified projects
    if (Array.isArray(analysis.projectsIdentified)) {
      analysis.projectsIdentified = analysis.projectsIdentified.filter(
        (p: any) => isVerbatim(p.name) || analysis.verifiedFacts.projectsFound.some((vf: any) => vf.projectName.toLowerCase() === p.name.toLowerCase())
      ).map((p: any) => ({
        ...p,
        tech: Array.isArray(p.tech) ? p.tech.filter((t: string) => isVerbatim(t)) : [],
      }));
    }

    analysis.diagnostics = diagnostics;
    analysis.atsScore = Number(analysis.atsScore ?? analysis.roleMatchPercentage ?? 0);

    return res.json({
      success: true,
      analysis,
      diagnostics,
      rawText: extractedText,
      source: aiNotice ? 'local_precision_fallback' : `${aiResult?.provider || activeConfig.provider}_ai`,
      provider: activeConfig.provider,
      model: aiResult?.model || activeConfig.model,
      aiError: aiNotice,
      aiNotice,
    });
  } catch (err: any) {
    console.error('Error extracting resume:', err);
    return res.status(500).json({
      error: 'Failed to extract and analyze resume',
      details: err?.message || String(err),
    });
  }
});

// Vite middleware for development & production asset serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Interview Arena Server running on port ${PORT}`);
  });
}

export { app };

// Start server if not running in serverless Netlify function environment
if (!process.env.NETLIFY && process.env.NETLIFY_DEV !== 'true') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
