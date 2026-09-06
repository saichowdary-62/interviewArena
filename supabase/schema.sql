-- ==========================================================
-- Interview Arena Database Schema (Supabase / PostgreSQL)
-- Tables: profiles, resumes, interviews, questions, answers, scores, analytics
-- With Foreign Keys, Cascades, Indexes, and Row Level Security (RLS)
-- ==========================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================================
-- 1. PROFILES TABLE
-- Synced with auth.users (id references auth.users)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  institution TEXT DEFAULT 'National Institute of Technology',
  batch_year TEXT DEFAULT 'Batch 2026',
  target_role TEXT DEFAULT 'Software Development Engineer (SDE-1)',
  target_company_track TEXT DEFAULT 'Tier-1 Product & Fintech (Stripe, Google, Amazon)',
  readiness_score INTEGER DEFAULT 0,
  readiness_delta NUMERIC(4,1) DEFAULT 0.0,
  interviews_completed INTEGER DEFAULT 0,
  avg_performance NUMERIC(4,1) DEFAULT 0.0,
  improvement_areas_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Trigger to auto-create profile on auth.users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, institution, target_role, target_company_track)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'institution', 'National Institute of Technology'),
    COALESCE(NEW.raw_user_meta_data->>'target_role', 'Software Development Engineer (SDE-1)'),
    COALESCE(NEW.raw_user_meta_data->>'target_company_track', 'Tier-1 Product & Fintech (Stripe, Google, Amazon)')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================
-- 2. RESUMES TABLE
-- Stores uploaded candidate resumes, parsed skills, and role match
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size TEXT DEFAULT '342 KB',
  storage_path TEXT,
  raw_text TEXT,
  target_role TEXT DEFAULT 'Software Development Engineer (SDE-1)',
  role_match_percentage INTEGER DEFAULT 0,
  skills_extracted JSONB DEFAULT '[]'::jsonb,
  projects_identified JSONB DEFAULT '[]'::jsonb,
  strengths JSONB DEFAULT '[]'::jsonb,
  missing_skills JSONB DEFAULT '[]'::jsonb,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON public.resumes(created_at DESC);

-- Resumes RLS
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own resumes" ON public.resumes;
CREATE POLICY "Users can manage own resumes"
  ON public.resumes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================================
-- 3. INTERVIEWS TABLE
-- Stores complete mock interview assessment sessions
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  role_track TEXT NOT NULL,
  company_benchmark TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed',
  duration_minutes INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  verdict TEXT DEFAULT 'Interview Completed',
  key_feedback TEXT,
  dimensions JSONB DEFAULT '[]'::jsonb,
  radar_metrics JSONB DEFAULT '[]'::jsonb,
  skill_heatmap JSONB DEFAULT '[]'::jsonb,
  improvement_roadmap JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON public.interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON public.interviews(created_at DESC);

-- Interviews RLS
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own interviews" ON public.interviews;
CREATE POLICY "Users can manage own interviews"
  ON public.interviews FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================================
-- 4. QUESTIONS TABLE
-- Stores individual questions presented during an interview
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 1,
  track TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_text TEXT NOT NULL,
  context_prompt TEXT,
  interviewer JSONB DEFAULT '{}'::jsonb,
  evaluation_criteria JSONB DEFAULT '[]'::jsonb,
  hint TEXT,
  sample_key_points JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_interview_id ON public.questions(interview_id);

-- Questions RLS (Cascaded through interview ownership)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access questions for their interviews" ON public.questions;
CREATE POLICY "Users can access questions for their interviews"
  ON public.questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = questions.interview_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = questions.interview_id AND i.user_id = auth.uid()
    )
  );

-- ==========================================================
-- 5. ANSWERS TABLE
-- Stores spoken transcripts, notes, and vocal telemetry per question
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  candidate_answer TEXT,
  candidate_notes TEXT,
  audio_url TEXT,
  wpm INTEGER DEFAULT 0,
  filler_words_count INTEGER DEFAULT 0,
  confidence_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answers_user_id ON public.answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_interview_id ON public.answers(interview_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);

-- Answers RLS
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own answers" ON public.answers;
CREATE POLICY "Users can manage own answers"
  ON public.answers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================================
-- 6. SCORES TABLE
-- Stores rubric evaluation scores per question & interview
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  overall_score INTEGER NOT NULL,
  technical_score INTEGER DEFAULT 0,
  communication_score INTEGER DEFAULT 0,
  relevance_score INTEGER DEFAULT 0,
  problem_solving_score INTEGER DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id ON public.scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_interview_id ON public.scores(interview_id);

-- Scores RLS
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own scores" ON public.scores;
CREATE POLICY "Users can manage own scores"
  ON public.scores FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================================
-- 7. ANALYTICS TABLE
-- Stores placement readiness tracking, historical snapshots & percentiles
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  readiness_score INTEGER NOT NULL,
  cohort_percentile INTEGER DEFAULT 50,
  radar_data JSONB DEFAULT '[]'::jsonb,
  skill_breakdown JSONB DEFAULT '[]'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_recorded_at ON public.analytics(recorded_at DESC);

-- Analytics RLS
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own analytics" ON public.analytics;
CREATE POLICY "Users can manage own analytics"
  ON public.analytics FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================================
-- 8. COMPATIBILITY VIEWS (For legacy and alternate table names)
-- ==========================================================
CREATE OR REPLACE VIEW public.interview_sessions AS
  SELECT * FROM public.interviews;

CREATE OR REPLACE VIEW public.readiness_history AS
  SELECT
    id,
    user_id,
    interview_id AS session_id,
    readiness_score AS score,
    cohort_percentile AS percentile,
    recorded_at
  FROM public.analytics;

-- ==========================================================
-- 9. STORAGE BUCKET CONFIGURATION (For resume files)
-- ==========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can upload their own resume file" ON storage.objects;
CREATE POLICY "Users can upload their own resume file"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can read their own resume file" ON storage.objects;
CREATE POLICY "Users can read their own resume file"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own resume file" ON storage.objects;
CREATE POLICY "Users can update their own resume file"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own resume file" ON storage.objects;
CREATE POLICY "Users can delete their own resume file"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
