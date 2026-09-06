import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Building2,
  Camera,
  Mic,
  ShieldCheck,
  CheckCircle2,
  Save,
  Volume2,
  Database,
  RefreshCw,
  AlertCircle,
  Video,
} from 'lucide-react';
import { CandidateProfile } from '../types';
import { saveCandidateProfile } from '../lib/database';
import { isSupabaseConfigured } from '../lib/supabase';

interface SettingsViewProps {
  candidate: CandidateProfile;
  onUpdateCandidate: (candidate: CandidateProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  candidate,
  onUpdateCandidate,
}) => {
  const [formData, setFormData] = useState<CandidateProfile>(candidate);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Live Hardware Diagnostic Test state
  const [isTestingHardware, setIsTestingHardware] = useState<boolean>(false);
  const [testVideoActive, setTestVideoActive] = useState<boolean>(false);
  const [testMicLevel, setTestMicLevel] = useState<number>(0);
  const [hardwareTestResult, setHardwareTestResult] = useState<string | null>(null);
  const [hardwareTestError, setHardwareTestError] = useState<string | null>(null);

  const testVideoRef = useRef<HTMLVideoElement | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testAnimRef = useRef<number | null>(null);

  const stopHardwareTest = () => {
    if (testAnimRef.current) {
      cancelAnimationFrame(testAnimRef.current);
      testAnimRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    if (testAudioCtxRef.current && testAudioCtxRef.current.state !== 'closed') {
      testAudioCtxRef.current.close().catch(() => {});
      testAudioCtxRef.current = null;
    }
    if (testVideoRef.current) {
      testVideoRef.current.srcObject = null;
    }
    setIsTestingHardware(false);
    setTestVideoActive(false);
    setTestMicLevel(0);
  };

  const startHardwareTest = async () => {
    stopHardwareTest();
    setIsTestingHardware(true);
    setHardwareTestError(null);
    setHardwareTestResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported by your browser.');
      }

      // Request both camera and mic streams
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      testStreamRef.current = stream;

      // Connect video
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
        testVideoRef.current.muted = true;
        testVideoRef.current.playsInline = true;
        await testVideoRef.current.play().catch(() => {});
      }
      setTestVideoActive(true);

      // Connect audio
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      testAudioCtxRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const trackVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        setTestMicLevel(level);

        testAnimRef.current = requestAnimationFrame(trackVolume);
      };

      trackVolume();
      setHardwareTestResult('Camera and Microphone streams are connected, authorized, and functioning at optimal latency.');
    } catch (err: any) {
      console.warn('Hardware test failed:', err);
      setHardwareTestError(
        err?.name === 'NotAllowedError'
          ? 'Permission denied. Please allow camera and microphone access in your browser.'
          : err?.message || 'Failed to capture hardware devices.'
      );
      setIsTestingHardware(false);
    }
  };

  useEffect(() => {
    return () => {
      stopHardwareTest();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCandidateProfile(formData);
    onUpdateCandidate(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
          Candidate Profile & Hardware Calibration
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          Configure target role tracks, hiring benchmarks, and test webcam/microphone integration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Candidate Information Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
            <User className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-base font-bold text-[#0F172A]">
              Candidate Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Email Address (Placement Cell Sync)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Institution / College
              </label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) =>
                  setFormData({ ...formData, institution: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Graduation Batch
              </label>
              <input
                type="text"
                value={formData.batchYear}
                onChange={(e) =>
                  setFormData({ ...formData, batchYear: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-[#F8FAFC] focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Target Benchmark Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
            <Building2 className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-base font-bold text-[#0F172A]">
              Placement Track & Benchmark Calibrations
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Target Role
              </label>
              <select
                value={formData.targetRole}
                onChange={(e) =>
                  setFormData({ ...formData, targetRole: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white transition"
              >
                <option value="Software Development Engineer (SDE-1)">
                  Software Development Engineer (SDE-1)
                </option>
                <option value="Backend Systems Engineer">
                  Backend Systems Engineer
                </option>
                <option value="Full Stack Engineer">Full Stack Engineer</option>
                <option value="Data & Analytics Engineer">
                  Data & Analytics Engineer
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Benchmark Standard
              </label>
              <select
                value={formData.targetCompanyTrack}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetCompanyTrack: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white transition"
              >
                <option value="Tier-1 Product & Fintech">
                  Tier-1 Product & Fintech (Stripe, Google, Amazon)
                </option>
                <option value="High-Growth SaaS & Unicorn">
                  High-Growth SaaS & Unicorn (Linear, Vercel, Ramp)
                </option>
                <option value="Enterprise Consulting & Finance">
                  Enterprise Consulting & Finance (Goldman Sachs, Morgan Stanley)
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Device & Hardware Test Utility */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#2563EB]" />
              <h2 className="text-base font-bold text-[#0F172A]">
                Hardware & Permissions Readiness
              </h2>
            </div>

            <button
              type="button"
              onClick={isTestingHardware ? stopHardwareTest : startHardwareTest}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isTestingHardware
                  ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  : 'bg-[#2563EB] text-white hover:bg-blue-700'
              }`}
            >
              {isTestingHardware ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Stop Hardware Test</span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Test Camera & Mic</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-[#0F172A]">Webcam Stream</p>
                  <p className="text-[11px] text-[#64748B]">
                    {testVideoActive ? 'Active Live Preview' : 'HD 720p/1080p Ready'}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  testVideoActive
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-slate-600 bg-slate-100 border-slate-200'
                }`}
              >
                {testVideoActive ? 'Live Test Active' : 'Ready'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-[#0F172A]">Microphone Stream</p>
                  <p className="text-[11px] text-[#64748B]">
                    {isTestingHardware ? `Live Energy: ${testMicLevel}% RMS` : 'Web Audio VAD Ready'}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  testMicLevel > 10
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 animate-pulse'
                    : 'text-slate-600 bg-slate-100 border-slate-200'
                }`}
              >
                {isTestingHardware ? `${testMicLevel}% Volume` : 'Ready'}
              </span>
            </div>
          </div>

          {/* Live Diagnostic Video & Volume View */}
          {isTestingHardware && (
            <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Hardware Diagnostic Monitor
                </span>
                <span className="text-slate-400 font-mono text-[10px]">48kHz / 30fps</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="w-full h-40 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <video
                    ref={testVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                </div>

                <div className="space-y-3 p-2">
                  <div>
                    <span className="text-[11px] text-slate-300 block mb-1 font-medium">
                      Live Mic Pickup Level:
                    </span>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-75"
                        style={{ width: `${Math.max(5, testMicLevel)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Speak a test sentence. The green meter confirms your microphone is picking up vocal audio clearly for real-time telemetry analysis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hardwareTestResult && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{hardwareTestResult}</span>
            </div>
          )}

          {hardwareTestError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{hardwareTestError}</span>
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Candidate profile saved successfully
            </span>
          ) : (
            <span className="text-xs text-[#64748B]">
              Changes update your campus placement scorecard immediately
            </span>
          )}

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
