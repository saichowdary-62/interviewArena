import { supabase, isSupabaseConfigured } from './supabase';
import {
  CandidateProfile,
  ResumeAnalysisData,
  EvaluationReport,
  InterviewSession,
  InterviewQuestion,
} from '../types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface TablesStatus {
  isConfigured: boolean;
  isTablesCreated: boolean;
  missingTables: string[];
  checkedAt: string;
}

const STORAGE_KEYS = {
  USER: 'arena_current_user',
  PROFILE: 'arena_candidate_profile',
  RESUME: 'arena_active_resume',
  REPORT: 'arena_latest_report',
  SESSIONS: 'arena_interview_sessions',
  READINESS_HISTORY: 'arena_readiness_history',
};

// Clean default baseline profile (no fake mock completions)
export const DEFAULT_PROFILE: CandidateProfile = {
  name: 'Candidate',
  email: '',
  targetRole: 'Software Development Engineer (SDE-1)',
  targetCompanyTrack: 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
  institution: 'National Institute of Technology',
  batchYear: 'Batch 2026',
  readinessScore: 0,
  readinessDelta: 0.0,
  interviewsCompleted: 0,
  avgPerformance: 0.0,
  improvementAreasCount: 0,
};

// Clean default evaluation report (awaits real mock interview evaluation)
export const DEFAULT_REPORT: EvaluationReport = {
  overallScore: 0,
  percentile: 0,
  verdict: 'Pending Initial Evaluation',
  evaluationDate: 'Not started',
  cohortSize: 1420,
  dimensions: [
    {
      name: 'Technical Knowledge',
      score: 0,
      maxScore: 100,
      status: 'Awaiting Assessment',
      benchmark: 75,
      feedback: 'Complete your first mock interview to evaluate technical depth and concurrency.',
    },
    {
      name: 'Problem Solving',
      score: 0,
      maxScore: 100,
      status: 'Awaiting Assessment',
      benchmark: 76,
      feedback: 'Analytical approach and boundary condition handling will be scored.',
    },
    {
      name: 'System Architecture',
      score: 0,
      maxScore: 100,
      status: 'Awaiting Assessment',
      benchmark: 70,
      feedback: 'Trade-off articulation and high-throughput architectural choices.',
    },
    {
      name: 'Communication & Delivery',
      score: 0,
      maxScore: 100,
      status: 'Awaiting Assessment',
      benchmark: 72,
      feedback: 'Vocal pacing, structure, and professional cadence during responses.',
    },
    {
      name: 'Behavioral & Ownership',
      score: 0,
      maxScore: 100,
      status: 'Awaiting Assessment',
      benchmark: 75,
      feedback: 'Customer obsession and failure recovery mindset.',
    },
  ],
  radarMetrics: [
    { subject: 'System Design', score: 0, benchmark: 74, fullMark: 100 },
    { subject: 'Algorithms & DS', score: 0, benchmark: 78, fullMark: 100 },
    { subject: 'Communication', score: 0, benchmark: 70, fullMark: 100 },
    { subject: 'Concurrency', score: 0, benchmark: 65, fullMark: 100 },
    { subject: 'Problem Solving', score: 0, benchmark: 76, fullMark: 100 },
    { subject: 'Vocal Delivery', score: 0, benchmark: 72, fullMark: 100 },
  ],
  skillHeatmap: [],
  improvementRoadmap: [],
  historyTimeline: [],
};

// ==========================================
// 0. SUPABASE TABLES HEALTH & MIGRATION STATUS
// ==========================================

export async function checkSupabaseTablesStatus(): Promise<TablesStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      isConfigured: false,
      isTablesCreated: false,
      missingTables: ['profiles', 'resumes', 'interviews', 'questions', 'answers', 'scores', 'analytics'],
      checkedAt: new Date().toISOString(),
    };
  }

  const tablesToCheck = ['profiles', 'resumes', 'interviews', 'questions', 'answers', 'scores', 'analytics'];
  const missing: string[] = [];

  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('does not exist'))) {
        missing.push(table);
      }
    } catch {
      missing.push(table);
    }
  }

  return {
    isConfigured: true,
    isTablesCreated: missing.length === 0,
    missingTables: missing,
    checkedAt: new Date().toISOString(),
  };
}

// ==========================================
// 1. AUTHENTICATION SERVICE & SESSION PERSISTENCE (Supabase Auth Only)
// ==========================================

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return null;
    }

    const u = sessionData.session.user;
    const user: AuthUser = {
      id: u.id,
      email: u.email || '',
      name: u.user_metadata?.name || u.email?.split('@')[0] || 'Candidate',
    };
    return user;
  } catch (e) {
    console.warn('Supabase auth session check failed:', e);
    return null;
  }
}

export async function signInUser(
  email: string,
  password: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  const trimmedEmail = (email || '').trim();
  if (!trimmedEmail) {
    return { user: null, error: 'Please enter your email address.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { user: null, error: 'Please enter a valid email address format (e.g. candidate@university.edu).' };
  }

  if (!password) {
    return { user: null, error: 'Please enter your password.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      user: null,
      error: 'Supabase authentication service is currently unavailable or unconfigured.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      let friendlyError = error.message;
      const lower = error.message.toLowerCase();
      if (lower.includes('invalid login credentials')) {
        friendlyError = 'Invalid email or password. Please verify your credentials and try again.';
      } else if (lower.includes('email not confirmed')) {
        friendlyError = 'Your email address has not been confirmed yet. To enable instant logins without confirmation emails, turn off "Confirm email" in Supabase Dashboard -> Authentication -> Providers -> Email.';
      } else if (lower.includes('rate limit')) {
        friendlyError = 'Too many attempts. Please wait a few moments before trying again.';
      }
      return { user: null, error: friendlyError };
    }

    if (!data?.user) {
      return { user: null, error: 'Authentication failed. No user record returned.' };
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email || trimmedEmail,
      name: data.user.user_metadata?.name || trimmedEmail.split('@')[0],
    };

    // Fetch and sync profile from profiles table
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileData) {
        const mappedProfile: CandidateProfile = {
          name: profileData.name || user.name,
          email: profileData.email || user.email,
          targetRole: profileData.target_role || DEFAULT_PROFILE.targetRole,
          targetCompanyTrack: profileData.target_company_track || DEFAULT_PROFILE.targetCompanyTrack,
          institution: profileData.institution || DEFAULT_PROFILE.institution,
          batchYear: profileData.batch_year || DEFAULT_PROFILE.batchYear,
          readinessScore: profileData.readiness_score ?? 0,
          readinessDelta: Number(profileData.readiness_delta ?? 0),
          interviewsCompleted: profileData.interviews_completed ?? 0,
          avgPerformance: Number(profileData.avg_performance ?? 0),
          improvementAreasCount: profileData.improvement_areas_count ?? 0,
        };
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mappedProfile));
      }
    } catch (profileErr) {
      console.warn('Could not sync profile table on login:', profileErr);
    }

    return { user, error: null };
  } catch (err: any) {
    return {
      user: null,
      error: err?.message || 'Network failure communicating with authentication provider. Please try again.',
    };
  }
}

export async function signUpUser(
  email: string,
  password: string,
  fullName: string,
  institution?: string,
  targetRole?: string
): Promise<{ user: AuthUser | null; error: string | null; confirmationRequired?: boolean }> {
  const trimmedName = (fullName || '').trim();
  const trimmedEmail = (email || '').trim();

  if (!trimmedName) {
    return { user: null, error: 'Please enter your full name.' };
  }

  if (!trimmedEmail) {
    return { user: null, error: 'Please enter your email address.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { user: null, error: 'Please enter a valid email address format (e.g. candidate@university.edu).' };
  }

  if (!password) {
    return { user: null, error: 'Please create a secure password.' };
  }

  if (password.length < 6) {
    return { user: null, error: 'Password must be at least 6 characters long.' };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { user: null, error: 'Password must contain both letters and numbers for account security.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      user: null,
      error: 'Supabase authentication service is currently unavailable or unconfigured.',
    };
  }

  // Try server-side admin registration first (auto-confirms user and avoids email rate limit)
  try {
    const adminRes = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: trimmedEmail,
        password,
        fullName: trimmedName,
        institution: institution?.trim(),
        targetRole: targetRole?.trim(),
        targetCompanyTrack: 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
      }),
    });

    if (adminRes.ok) {
      const adminData = await adminRes.json();
      if (adminData.autoConfirmed && adminData.user) {
        // Sign in immediately to establish real Supabase session
        const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        const user: AuthUser = {
          id: adminData.user.id,
          email: adminData.user.email || trimmedEmail,
          name: trimmedName,
        };

        const initialProfile: CandidateProfile = {
          name: trimmedName,
          email: trimmedEmail,
          targetRole: targetRole || DEFAULT_PROFILE.targetRole,
          targetCompanyTrack: DEFAULT_PROFILE.targetCompanyTrack,
          institution: institution || DEFAULT_PROFILE.institution,
          batchYear: DEFAULT_PROFILE.batchYear,
          readinessScore: 0,
          readinessDelta: 0,
          interviewsCompleted: 0,
          avgPerformance: 0,
          improvementAreasCount: 0,
        };
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(initialProfile));

        return { user, error: null, confirmationRequired: false };
      }
    }
  } catch (adminErr) {
    // Proceed to standard client signup
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          name: trimmedName,
          institution: institution?.trim() || 'Engineering Institute',
          target_role: targetRole?.trim() || 'Software Development Engineer (SDE-1)',
          target_company_track: 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
        },
      },
    });

    if (error) {
      let friendlyError = error.message;
      const lower = error.message.toLowerCase();
      const isRateLimit =
        lower.includes('rate limit') ||
        lower.includes('over_email_send_rate_limit') ||
        (error as any).status === 429 ||
        (error as any).code === 'over_email_send_rate_limit';

      if (lower.includes('already registered')) {
        friendlyError = 'An account with this email address already exists. Please sign in instead.';
      } else if (isRateLimit) {
        friendlyError =
          'Supabase email rate limit reached (free-tier default allows only 3-4 emails/hour). In your Supabase Dashboard -> Authentication -> Providers -> Email, disable "Confirm email" to permit instant signups without sending confirmation emails.';
      } else if (lower.includes('signups not allowed')) {
        friendlyError = 'New registrations are disabled in your Supabase project settings. Please enable signups under Authentication settings.';
      }
      return { user: null, error: friendlyError };
    }

    if (!data?.user) {
      return { user: null, error: 'Account creation failed. No user was returned by authentication service.' };
    }

    // Check if user already exists (Supabase returns empty identities array when user is already registered)
    if (data.user.identities && data.user.identities.length === 0) {
      return {
        user: null,
        error: 'An account with this email address already exists. Please sign in instead.',
      };
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email || trimmedEmail,
      name: trimmedName,
    };

    // Store user profile in Supabase profiles table
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name: trimmedName,
        email: trimmedEmail,
        institution: institution?.trim() || 'Engineering Institute',
        batch_year: 'Batch 2026',
        target_role: targetRole?.trim() || 'Software Development Engineer (SDE-1)',
        target_company_track: 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
        readiness_score: 0,
        readiness_delta: 0,
        interviews_completed: 0,
        avg_performance: 0,
        improvement_areas_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (tableErr) {
      console.warn('Profile table insert warning:', tableErr);
    }

    const initialProfile: CandidateProfile = {
      name: trimmedName,
      email: trimmedEmail,
      targetRole: targetRole || DEFAULT_PROFILE.targetRole,
      targetCompanyTrack: DEFAULT_PROFILE.targetCompanyTrack,
      institution: institution || DEFAULT_PROFILE.institution,
      batchYear: DEFAULT_PROFILE.batchYear,
      readinessScore: 0,
      readinessDelta: 0,
      interviewsCompleted: 0,
      avgPerformance: 0,
      improvementAreasCount: 0,
    };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(initialProfile));

    // If session is already created (email confirmation was disabled in Supabase dashboard)
    if (data.session) {
      return { user, error: null, confirmationRequired: false };
    }

    // Attempt instant sign in in case project auto-confirms
    const { data: immediateLogin, error: immediateErr } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (immediateLogin?.session) {
      return { user, error: null, confirmationRequired: false };
    }

    const confirmationRequired = true;
    return { user, error: null, confirmationRequired };
  } catch (err: any) {
    return {
      user: null,
      error: err?.message || 'Network failure communicating with authentication provider. Please try again.',
    };
  }
}

export async function signOutUser(): Promise<{ error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase sign out error:', error.message);
        return { error: error.message };
      }
    } catch (e: any) {
      console.warn('Supabase sign out exception:', e);
      return { error: e?.message || 'Error signing out' };
    }
  }
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
  localStorage.removeItem(STORAGE_KEYS.RESUME);
  localStorage.removeItem(STORAGE_KEYS.REPORT);
  localStorage.removeItem(STORAGE_KEYS.SESSIONS);
  localStorage.removeItem(STORAGE_KEYS.READINESS_HISTORY);
  return { error: null };
}

// ==========================================
// 2. CANDIDATE PROFILE SERVICE (Table: profiles)
// ==========================================

export async function getCandidateProfile(): Promise<CandidateProfile> {
  const currentUser = await getCurrentUser();

  if (isSupabaseConfigured && supabase && currentUser) {
    try {
      // 1. Fetch profile
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      // 2. Query live counts from interviews table
      let liveInterviewsCount = 0;
      let liveAvgPerformance = 0;

      try {
        const { data: interviewRows, error: interviewErr } = await supabase
          .from('interviews')
          .select('score')
          .eq('user_id', currentUser.id);

        if (!interviewErr && interviewRows) {
          liveInterviewsCount = interviewRows.length;
          if (liveInterviewsCount > 0) {
            const sumScore = interviewRows.reduce((acc: number, curr: any) => acc + (Number(curr.score) || 0), 0);
            liveAvgPerformance = Number((sumScore / liveInterviewsCount).toFixed(1));
          }
        }
      } catch (e) {
        // interviews table may be pending creation
      }

      // 3. Query live resume for match percentage
      let resumeMatchPercentage = 0;
      try {
        const { data: resumeRow } = await supabase
          .from('resumes')
          .select('role_match_percentage')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (resumeRow?.role_match_percentage) {
          resumeMatchPercentage = Number(resumeRow.role_match_percentage);
        }
      } catch (e) {
        // resumes table may be pending
      }

      if (profileRow) {
        // Calculate live readiness score from performance & resume match
        const computedReadiness = liveInterviewsCount > 0
          ? Math.round(liveAvgPerformance * 0.7 + (resumeMatchPercentage || 70) * 0.3)
          : (resumeMatchPercentage > 0 ? Math.round(resumeMatchPercentage * 0.8) : (profileRow.readiness_score || 0));

        const mapped: CandidateProfile = {
          name: profileRow.name || currentUser.name,
          email: profileRow.email || currentUser.email,
          targetRole: profileRow.target_role || DEFAULT_PROFILE.targetRole,
          targetCompanyTrack: profileRow.target_company_track || DEFAULT_PROFILE.targetCompanyTrack,
          institution: profileRow.institution || DEFAULT_PROFILE.institution,
          batchYear: profileRow.batch_year || DEFAULT_PROFILE.batchYear,
          readinessScore: computedReadiness,
          readinessDelta: Number(profileRow.readiness_delta ?? 0),
          interviewsCompleted: Math.max(liveInterviewsCount, profileRow.interviews_completed || 0),
          avgPerformance: liveAvgPerformance > 0 ? liveAvgPerformance : Number(profileRow.avg_performance || 0),
          improvementAreasCount: profileRow.improvement_areas_count ?? (liveInterviewsCount > 0 ? 2 : 0),
        };

        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {
      console.warn('Failed to load profile from Supabase profiles table:', e);
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }

  if (currentUser) {
    return {
      ...DEFAULT_PROFILE,
      name: currentUser.name,
      email: currentUser.email,
    };
  }

  return DEFAULT_PROFILE;
}

export async function saveCandidateProfile(profile: CandidateProfile): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));

  const currentUser = await getCurrentUser();
  if (isSupabaseConfigured && supabase && currentUser) {
    try {
      await supabase.from('profiles').upsert({
        id: currentUser.id,
        name: profile.name,
        email: profile.email || currentUser.email,
        institution: profile.institution,
        batch_year: profile.batchYear,
        target_role: profile.targetRole,
        target_company_track: profile.targetCompanyTrack,
        readiness_score: profile.readinessScore,
        readiness_delta: profile.readinessDelta,
        interviews_completed: profile.interviewsCompleted,
        avg_performance: profile.avgPerformance,
        improvement_areas_count: profile.improvementAreasCount,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to save profile to Supabase profiles table:', e);
    }
  }
}

// ==========================================
// 3. RESUME STORAGE & PERSISTENCE (Table: resumes)
// ==========================================

export async function getActiveResume(): Promise<ResumeAnalysisData | null> {
  const currentUser = await getCurrentUser();

  if (isSupabaseConfigured && supabase && currentUser) {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          filename: data.filename,
          uploadedAt: new Date(data.created_at || data.uploaded_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          fileSize: data.file_size || '342 KB',
          targetRole: data.target_role || 'Software Development Engineer (SDE-1)',
          roleMatchPercentage: data.role_match_percentage || 0,
          diagnostics: data.diagnostics || undefined,
          verifiedFacts: data.verified_facts || undefined,
          explicitSkills: data.explicit_skills || undefined,
          matchBreakdown: data.match_breakdown || undefined,
          skillsExtracted: data.skills_extracted || [],
          projectsIdentified: data.projects_identified || [],
          strengths: data.strengths || [],
          missingSkills: data.missing_skills || [],
        };
      }
    } catch (e) {
      console.warn('Failed to fetch active resume from Supabase resumes table:', e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.RESUME);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  return null;
}

export async function saveResumeAnalysis(
  analysis: ResumeAnalysisData,
  rawText?: string,
  file?: File
): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.RESUME, JSON.stringify(analysis));

  const currentUser = await getCurrentUser();
  if (isSupabaseConfigured && supabase && currentUser) {
    try {
      let storagePath: string | undefined = undefined;

      // Upload file to Supabase storage bucket if file provided
      if (file) {
        try {
          const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${currentUser.id}/${Date.now()}_${cleanName}`;
          const { data: uploadData } = await supabase.storage
            .from('resumes')
            .upload(filePath, file, { upsert: true });
          if (uploadData?.path) {
            storagePath = uploadData.path;
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload notice:', storageErr);
        }
      }

      await supabase.from('resumes').insert({
        user_id: currentUser.id,
        filename: analysis.filename,
        file_size: analysis.fileSize,
        storage_path: storagePath,
        raw_text: rawText || '',
        target_role: analysis.targetRole,
        role_match_percentage: analysis.roleMatchPercentage,
        skills_extracted: analysis.skillsExtracted,
        projects_identified: analysis.projectsIdentified,
        strengths: analysis.strengths,
        missing_skills: analysis.missingSkills,
      });

      // Update profile readiness score if applicable
      await supabase.from('profiles').update({
        readiness_score: analysis.roleMatchPercentage,
        updated_at: new Date().toISOString(),
      }).eq('id', currentUser.id);

    } catch (e) {
      console.warn('Failed to record resume in Supabase resumes table:', e);
    }
  }
}

// ==========================================
// 4. INTERVIEWS, QUESTIONS, ANSWERS, SCORES & ANALYTICS
// (Tables: interviews, questions, answers, scores, analytics)
// ==========================================

export async function getEvaluationReport(): Promise<EvaluationReport> {
  const currentUser = await getCurrentUser();

  if (isSupabaseConfigured && supabase && currentUser) {
    try {
      // 1. Fetch latest interview
      let data: any = null;

      // Try primary interviews table
      const { data: interviewData, error: interviewErr } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!interviewErr && interviewData) {
        data = interviewData;
      } else {
        // Fallback check to interview_sessions if compatibility view exists
        const { data: sessionData } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = sessionData;
      }

      if (data && data.dimensions && data.dimensions.length > 0) {
        // 2. Fetch all past interviews for timeline
        let allInterviews: any[] = [];
        try {
          const { data: pastRows } = await supabase
            .from('interviews')
            .select('id, title, role_track, company_benchmark, score, status, duration_minutes, key_feedback, created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
          if (pastRows) allInterviews = pastRows;
        } catch {
          const { data: pastRows } = await supabase
            .from('interview_sessions')
            .select('id, title, role_track, company_benchmark, score, status, duration_minutes, key_feedback, created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
          if (pastRows) allInterviews = pastRows;
        }

        const historyTimeline: InterviewSession[] = allInterviews.map((s: any) => ({
          id: s.id,
          title: s.title,
          roleTrack: s.role_track,
          companyBenchmark: s.company_benchmark,
          date: new Date(s.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          score: s.score,
          status: s.status || 'completed',
          durationMinutes: s.duration_minutes || 42,
          strengthsCount: 3,
          improvementsCount: 1,
          keyFeedback: s.key_feedback || 'Completed full technical evaluation round.',
        }));

        // 3. Fetch latest analytics snapshot if present
        let latestAnalytics: any = null;
        try {
          const { data: anData } = await supabase
            .from('analytics')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          latestAnalytics = anData;
        } catch {
          // analytics table may be pending
        }

        return {
          overallScore: data.score,
          percentile: latestAnalytics?.cohort_percentile || 90,
          verdict: data.verdict || 'Strong Hire - SDE-1',
          evaluationDate: new Date(data.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          cohortSize: 1420,
          dimensions: data.dimensions,
          radarMetrics: latestAnalytics?.radar_data || data.radar_metrics || DEFAULT_REPORT.radarMetrics,
          skillHeatmap: latestAnalytics?.skill_breakdown || data.skill_heatmap || DEFAULT_REPORT.skillHeatmap,
          improvementRoadmap: data.improvement_roadmap || DEFAULT_REPORT.improvementRoadmap,
          historyTimeline,
        };
      }
    } catch (e) {
      console.warn('Failed to load report from Supabase interviews table:', e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.REPORT);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  return DEFAULT_REPORT;
}

export async function saveInterviewSessionRecord(
  report: EvaluationReport,
  questions: InterviewQuestion[],
  answers: Record<number, string>,
  notes: Record<number, string>,
  elapsedSeconds: number,
  candidateProfile: CandidateProfile
): Promise<void> {
  // Update local report
  localStorage.setItem(STORAGE_KEYS.REPORT, JSON.stringify(report));

  // Add new session item to history
  const newSession: InterviewSession = {
    id: 'ses-' + Date.now(),
    title: `${questions[0]?.track || 'Distributed Systems'} Assessment`,
    roleTrack: candidateProfile.targetRole,
    companyBenchmark: candidateProfile.targetCompanyTrack,
    date: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    score: report.overallScore,
    status: 'completed',
    durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
    strengthsCount: 3,
    improvementsCount: 1,
    keyFeedback: report.dimensions?.[0]?.feedback || 'Evaluation complete.',
  };

  const currentTimeline = report.historyTimeline || [];
  report.historyTimeline = [newSession, ...currentTimeline.filter((s) => s.id !== newSession.id)];
  localStorage.setItem(STORAGE_KEYS.REPORT, JSON.stringify(report));

  // Save to live Supabase across all 5 tables: interviews, questions, answers, scores, analytics
  const currentUser = await getCurrentUser();
  if (isSupabaseConfigured && supabase && currentUser) {
    try {
      // 1. Table: interviews
      let interviewId: string | null = null;

      try {
        const { data: interviewData, error: intErr } = await supabase
          .from('interviews')
          .insert({
            user_id: currentUser.id,
            title: newSession.title,
            role_track: newSession.roleTrack,
            company_benchmark: newSession.companyBenchmark,
            score: report.overallScore,
            status: 'completed',
            duration_minutes: newSession.durationMinutes,
            duration_seconds: elapsedSeconds,
            verdict: report.verdict,
            key_feedback: newSession.keyFeedback,
            dimensions: report.dimensions,
            radar_metrics: report.radarMetrics,
            skill_heatmap: report.skillHeatmap,
            improvement_roadmap: report.improvementRoadmap,
          })
          .select('id')
          .single();

        if (interviewData?.id) {
          interviewId = interviewData.id;
        }
      } catch (intErr) {
        console.warn('Interviews table insert warning:', intErr);
      }

      // Also try interview_sessions if compatibility
      if (!interviewId) {
        try {
          const { data: sData } = await supabase
            .from('interview_sessions')
            .insert({
              user_id: currentUser.id,
              title: newSession.title,
              role_track: newSession.roleTrack,
              company_benchmark: newSession.companyBenchmark,
              score: report.overallScore,
              status: 'completed',
              duration_minutes: newSession.durationMinutes,
              duration_seconds: elapsedSeconds,
              verdict: report.verdict,
              key_feedback: newSession.keyFeedback,
              dimensions: report.dimensions,
              radar_metrics: report.radarMetrics,
              skill_heatmap: report.skillHeatmap,
              improvement_roadmap: report.improvementRoadmap,
            })
            .select('id')
            .single();
          if (sData?.id) interviewId = sData.id;
        } catch {}
      }

      if (interviewId) {
        // 2. Table: questions
        try {
          const questionsPayload = questions.map((q, idx) => ({
            interview_id: interviewId,
            question_number: q.questionNumber || idx + 1,
            total_questions: q.totalQuestions || questions.length,
            track: q.track || 'Technical',
            title: q.title || `Question ${idx + 1}`,
            category: q.category || 'General Architecture',
            difficulty: q.difficulty || 'Medium',
            question_text: q.questionText,
            context_prompt: q.contextPrompt || '',
            interviewer: q.interviewer || {},
            evaluation_criteria: q.evaluationCriteria || [],
            hint: q.hint || '',
            sample_key_points: q.sampleKeyPoints || [],
          }));

          const { data: insertedQuestions } = await supabase
            .from('questions')
            .insert(questionsPayload)
            .select('id, question_number');

          // 3. Table: answers
          const questionIdMap: Record<number, string> = {};
          if (insertedQuestions) {
            insertedQuestions.forEach((iq: any) => {
              questionIdMap[iq.question_number] = iq.id;
            });
          }

          const answersPayload = questions.map((q, idx) => {
            const qNum = q.questionNumber || idx + 1;
            const qId = questionIdMap[qNum] || undefined;
            return {
              user_id: currentUser.id,
              interview_id: interviewId,
              question_id: qId,
              candidate_answer: answers[idx] || answers[q.id] || '',
              candidate_notes: notes[idx] || notes[q.id] || '',
              wpm: 135,
              filler_words_count: 2,
              confidence_score: report.overallScore,
            };
          }).filter((a) => Boolean(a.question_id));

          if (answersPayload.length > 0) {
            await supabase.from('answers').insert(answersPayload);
          }

          // 4. Table: scores
          const scoresPayload = report.dimensions.map((dim) => ({
            user_id: currentUser.id,
            interview_id: interviewId,
            overall_score: dim.score,
            technical_score: dim.score,
            communication_score: report.overallScore,
            relevance_score: dim.score,
            problem_solving_score: dim.score,
            feedback: dim.feedback || '',
          }));

          await supabase.from('scores').insert(scoresPayload);
        } catch (qErr) {
          console.warn('Questions/Answers/Scores tables insert warning:', qErr);
        }

        // 5. Table: analytics
        try {
          await supabase.from('analytics').insert({
            user_id: currentUser.id,
            interview_id: interviewId,
            readiness_score: report.overallScore,
            cohort_percentile: report.percentile || 90,
            radar_data: report.radarMetrics,
            skill_breakdown: report.skillHeatmap,
          });
        } catch (anErr) {
          console.warn('Analytics table insert warning:', anErr);
        }

        // 6. Update Profile in profiles table
        try {
          const { count } = await supabase
            .from('interviews')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

          const updatedInterviewsCount = count || (candidateProfile.interviewsCompleted + 1);

          await supabase.from('profiles').update({
            interviews_completed: updatedInterviewsCount,
            readiness_score: report.overallScore,
            avg_performance: report.overallScore,
            updated_at: new Date().toISOString(),
          }).eq('id', currentUser.id);
        } catch (profErr) {
          console.warn('Profile table update warning:', profErr);
        }
      }
    } catch (e) {
      console.warn('Failed to save full interview records to Supabase:', e);
    }
  }
}
