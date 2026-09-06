import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Building2,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { signInUser, signUpUser, AuthUser } from '../lib/database';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [institution, setInstitution] = useState<string>('National Institute of Technology');
  const [targetRole, setTargetRole] = useState<string>('Software Development Engineer (SDE-1)');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Sync mode whenever modal opens or initialMode changes
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
      setInfoMessage(null);
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address format (e.g. user@domain.com).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        setErrorMessage('Password must contain both letters and numbers for account security.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const { user, error } = await signInUser(trimmedEmail, password);
        if (error || !user) {
          setErrorMessage(error || 'Invalid credentials. Please verify your email and password.');
        } else {
          onAuthSuccess(user);
          onClose();
        }
      } else {
        const { user, error, confirmationRequired } = await signUpUser(
          trimmedEmail,
          password,
          fullName.trim(),
          institution.trim(),
          targetRole.trim()
        );
        if (error || !user) {
          setErrorMessage(error || 'Failed to create account.');
        } else if (confirmationRequired) {
          setInfoMessage(
            'Account created! If email confirmation is enabled in your Supabase project, check your inbox to confirm. Otherwise, you can sign in directly.'
          );
          setMode('signin');
        } else {
          onAuthSuccess(user);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100vh-2rem)]">
        {/* Top Header */}
        <div className="p-6 pb-4 bg-gradient-to-b from-[#F8FAFC] to-white border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-[#0F172A] tracking-tight">
                {mode === 'signin' ? 'Welcome Back' : 'Create Candidate Account'}
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                {mode === 'signin'
                  ? 'Sign in to access your mock scores and resume telemetry'
                  : 'Register your college profile for verified readiness benchmarking'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-slate-100 transition shrink-0 mt-0.5"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 mt-4 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className={`py-2 rounded-lg transition text-center font-semibold ${
                mode === 'signin'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className={`py-2 rounded-lg transition text-center font-semibold ${
                mode === 'signup'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Form Body - Scrollable if screen is compact */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{errorMessage}</div>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-800 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{infoMessage}</div>
            </div>
          )}

          {mode === 'signup' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Candidate Name"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Institution / Engineering College
                </label>
                <div className="relative flex items-center">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. National Institute of Technology"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Target Role
                </label>
                <div className="relative flex items-center">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Software Development Engineer (SDE-1)"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full pl-9 pr-3 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                Password
              </label>
              {mode === 'signin' && (
                <span className="text-[10px] text-blue-600 hover:underline cursor-pointer">
                  Forgot?
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="text-[10px] text-slate-500 mt-1">
                Must be at least 6 characters with both letters and numbers.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In to Arena' : 'Register Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-[#64748B] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Secured with Supabase Auth & Row Level Security</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
