import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Maximize2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Activity,
  Terminal,
  X,
  AlertTriangle,
} from 'lucide-react';
import { DeliveryTelemetry } from '../types';
import { VideoInterviewAnalyzer, InstantaneousVideoMetrics } from '../lib/videoInterviewAnalyzer';

interface WebcamPreviewProps {
  candidateName: string;
  isAudioRecording: boolean;
  onToggleRecording?: () => void;
  onEyeContactUpdate?: (score: number, status: DeliveryTelemetry['eyeContactStatus']) => void;
  analyzer?: VideoInterviewAnalyzer;
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = ({
  candidateName,
  isAudioRecording,
  onToggleRecording,
  onEyeContactUpdate,
  analyzer,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const internalAnalyzerRef = useRef<VideoInterviewAnalyzer | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoResolution, setVideoResolution] = useState<string>('720p • 30fps');
  const [lightingStatus, setLightingStatus] = useState<'Optimal Lighting' | 'Adequate' | 'Low Light' | 'Backlit'>('Optimal Lighting');
  const [showFramingGrid, setShowFramingGrid] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [liveMetrics, setLiveMetrics] = useState<InstantaneousVideoMetrics | null>(null);

  // Progressive camera stream acquirer
  const requestCameraStream = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('navigator.mediaDevices is not supported in this browser environment.');
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
    } catch (err1) {
      console.warn('[Camera] 720p constraint failed, falling back to user facing:', err1);
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
    } catch (err2) {
      console.warn('[Camera] User facing constraint failed, falling back to any video:', err2);
    }

    return await navigator.mediaDevices.getUserMedia({ video: true });
  }, []);

  const stopCameraStream = useCallback(() => {
    const activeEngine = analyzer || internalAnalyzerRef.current;
    if (activeEngine) {
      activeEngine.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsVideoPlaying(false);
  }, [analyzer]);

  const startCamera = useCallback(async () => {
    setIsLoadingCamera(true);
    setStreamError(null);
    setIsPermissionDenied(false);

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await requestCameraStream();
      mediaStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
        if (settings.width && settings.height) {
          setVideoResolution(`${settings.height}p • ${Math.round(settings.frameRate || 30)}fps`);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setIsVideoPlaying(true);
        } catch (playErr) {
          console.warn('[WebcamPreview] Autoplay was prevented; waiting for user action:', playErr);
        }
      }
    } catch (err: any) {
      console.warn('[WebcamPreview] Camera init failed:', err);
      let errorMsg = 'Could not start camera. Please verify device permissions in your browser.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Click the camera icon in your address bar to allow access, then retry.';
        setIsPermissionDenied(true);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No video capture device detected. Please connect a webcam.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is already in use by another tab or program.';
      }
      setStreamError(errorMsg);
      setIsVideoPlaying(false);
    } finally {
      setIsLoadingCamera(false);
    }
  }, [requestCameraStream]);

  // Handle camera activation toggle
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [cameraActive, startCamera, stopCameraStream]);

  // Connect analyzer when video element is playing
  useEffect(() => {
    if (!analyzer && !internalAnalyzerRef.current) {
      internalAnalyzerRef.current = new VideoInterviewAnalyzer();
    }
    const currentEngine = analyzer || internalAnalyzerRef.current;
    if (!currentEngine) return;

    if (isVideoPlaying && videoRef.current && cameraActive) {
      currentEngine.attachVideoElement(videoRef.current);
      currentEngine.start();

      const unsubscribe = currentEngine.subscribe((m) => {
        setLiveMetrics(m);

        if (m.lightingAssessment === 'Low Light') {
          setLightingStatus('Low Light');
        } else if (m.lightingAssessment === 'Backlit') {
          setLightingStatus('Backlit');
        } else if (m.lightingAssessment === 'Adequate') {
          setLightingStatus('Adequate');
        } else {
          setLightingStatus('Optimal Lighting');
        }

        if (onEyeContactUpdate) {
          let status: DeliveryTelemetry['eyeContactStatus'] = 'Direct Eye Contact';
          if (m.gazeState === 'Looking Down (Notes)') status = 'Looking Away';
          else if (m.gazeState === 'Lateral Drift') status = 'Looking Away';
          else if (m.gazeState === 'Uncertain / Occluded') status = 'Low Lighting';
          onEyeContactUpdate(m.eyeContactScore, status);
        }
      });

      return () => {
        unsubscribe();
      };
    } else {
      currentEngine.stop();
    }
  }, [isVideoPlaying, cameraActive, analyzer, onEyeContactUpdate]);

  const toggleCamera = () => {
    setCameraActive((prev) => !prev);
  };

  const retryCameraAccess = () => {
    setCameraActive(true);
    startCamera();
  };

  const activeEngine = analyzer || internalAnalyzerRef.current;
  const currentReportSnapshot = activeEngine ? activeEngine.generateSessionReport() : null;

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-900 rounded-xl overflow-hidden flex flex-col border border-slate-800 shadow-sm">
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-slate-950/95 to-transparent flex items-center justify-between text-white text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isVideoPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span className="font-semibold text-slate-100 tracking-wide">{candidateName}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 font-mono text-[10px] border border-slate-700">
            {videoResolution}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${
              lightingStatus === 'Optimal Lighting'
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                : lightingStatus === 'Adequate'
                ? 'text-sky-400 bg-sky-950/60 border-sky-800/40'
                : 'text-amber-400 bg-amber-950/60 border-amber-800/40'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{lightingStatus}</span>
          </span>

          <button
            type="button"
            onClick={() => setShowFramingGrid((prev) => !prev)}
            title="Toggle Framing Guide"
            className={`p-1.5 rounded transition ${
              showFramingGrid ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            title="Inspect Video Analysis Logs & Frame Diagnostics"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-medium text-[11px] border border-slate-700 transition"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>Video Audit</span>
          </button>
        </div>
      </div>

      {/* Video Content Area */}
      <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            setIsVideoPlaying(true);
            videoRef.current?.play().catch(() => {});
          }}
          onPlaying={() => setIsVideoPlaying(true)}
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
            cameraActive && !streamError && isVideoPlaying ? 'opacity-100 block' : 'opacity-0 hidden'
          }`}
        />

        {/* Loading Spinner */}
        {isLoadingCamera && cameraActive && !streamError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <p>Initializing camera stream...</p>
          </div>
        )}

        {/* Error or Muted Fallback Card */}
        {(!cameraActive || streamError || (!isLoadingCamera && !isVideoPlaying)) && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm z-10">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">
                {candidateName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'CA'}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                  isAudioRecording ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                }`}
              >
                <Mic className="w-2.5 h-2.5 text-white" />
              </span>
            </div>

            <h4 className="text-sm font-semibold text-slate-200">
              {candidateName}
            </h4>

            {streamError ? (
              <div className="mt-2 space-y-2">
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-300 text-xs text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <p className="leading-relaxed">{streamError}</p>
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={retryCameraAccess}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isPermissionDenied ? 'Request Permission Again' : 'Retry Camera'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-xs text-slate-400">
                  {cameraActive ? 'Connecting webcam...' : 'Camera is muted'}
                </p>
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                >
                  Enable Live Camera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Facial Tracking Bounding Box when Framing is active */}
        {showFramingGrid && cameraActive && !streamError && liveMetrics?.faceBox && (
          <div
            className="absolute border-2 border-emerald-400/80 rounded-lg pointer-events-none transition-all duration-200 z-15 shadow-sm"
            style={{
              left: `${100 - (liveMetrics.faceBox.x + liveMetrics.faceBox.width)}%`,
              top: `${liveMetrics.faceBox.y}%`,
              width: `${liveMetrics.faceBox.width}%`,
              height: `${liveMetrics.faceBox.height}%`,
            }}
          >
            <div className="absolute -top-5 left-0 bg-emerald-950/90 text-emerald-300 text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-700/50">
              Face {Math.round(liveMetrics.faceConfidence * 100)}%
            </div>
          </div>
        )}

        {/* Rule of Thirds Overlay */}
        {showFramingGrid && cameraActive && !streamError && (
          <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 border border-dashed border-blue-500/30">
            <div className="border-b border-r border-blue-500/20" />
            <div className="border-b border-r border-blue-500/20 flex items-center justify-center">
              <div className="w-32 h-40 border-2 border-emerald-400/60 rounded-full border-dashed flex items-center justify-center">
                <span className="text-[10px] text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded font-mono">
                  Target Centering
                </span>
              </div>
            </div>
            <div className="border-b border-blue-500/20" />
            <div className="border-b border-r border-blue-500/20" />
            <div className="border-b border-r border-blue-500/20" />
            <div className="border-b border-blue-500/20" />
            <div className="border-r border-blue-500/20" />
            <div className="border-r border-blue-500/20" />
            <div />
          </div>
        )}

        {/* Live Behavioral Telemetry Badge Strip */}
        {cameraActive && isVideoPlaying && liveMetrics && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[11px] text-slate-100 flex items-center gap-1.5 shadow-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveMetrics.eyeContactScore >= 75 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="font-semibold">Eye Contact {liveMetrics.eyeContactScore}%</span>
              </span>

              <span className="px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[11px] text-slate-200 shadow-sm">
                {liveMetrics.gazeState}
              </span>

              <span className="px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[11px] text-slate-200 shadow-sm">
                {liveMetrics.expressionState}
              </span>
            </div>

            <span
              className={`px-2 py-1 rounded-md backdrop-blur-md text-[10px] font-mono border shadow-sm ${
                liveMetrics.faceConfidence >= 0.65
                  ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-700/60 text-amber-300'
              }`}
            >
              {liveMetrics.faceConfidence >= 0.65 ? 'Sensor: High Certainty' : 'Sensor: Low Signal'}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Floating Media Toolbar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              cameraActive && !streamError
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {cameraActive && !streamError ? (
              <>
                <Camera className="w-3.5 h-3.5 text-blue-400" />
                <span>Camera On</span>
              </>
            ) : (
              <>
                <CameraOff className="w-3.5 h-3.5 text-red-400" />
                <span>Camera Off</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              isAudioRecording
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isAudioRecording ? (
              <>
                <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Mic Active</span>
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Mic Standby</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Local Computer Vision Stream</span>
        </div>
      </div>

      {/* Video Analyzer Diagnostics & Validation Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Video Interview Analyzer Engine</h3>
                  <p className="text-xs text-slate-400">Empirical Computer-Vision Telemetry & Validation Logs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Sampling Rate</div>
                  <div className="text-base font-bold text-white mt-1">2.8 FPS</div>
                  <div className="text-[10px] text-slate-400">350ms interval</div>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Samples</div>
                  <div className="text-base font-bold text-cyan-400 mt-1">
                    {currentReportSnapshot?.diagnostics?.totalSamples || 0} frames
                  </div>
                  <div className="text-[10px] text-slate-400">Continuous buffer</div>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Face Certainty</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    {liveMetrics?.faceConfidence ? Math.round(liveMetrics.faceConfidence * 100) : 0}%
                  </div>
                  <div className="text-[10px] text-slate-400">Biometric bounding</div>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Illuminance</div>
                  <div className="text-base font-bold text-amber-400 mt-1">
                    {liveMetrics?.lightingLuxIndex || 0} / 255
                  </div>
                  <div className="text-[10px] text-slate-400">{lightingStatus}</div>
                </div>
              </div>

              {/* Evaluated Dimensions Status */}
              <div className="p-3.5 bg-slate-800/50 rounded-lg border border-slate-700/60 space-y-2">
                <div className="font-semibold text-slate-200 text-xs flex items-center justify-between">
                  <span>Continuous 7-Parameter Evaluation Checklist</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Active Monitoring</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Eye Contact: {liveMetrics?.gazeState || 'Monitoring'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Facial Expressions: {liveMetrics?.expressionState || 'Monitoring'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Confidence & Stability: Motion Index {liveMetrics?.motionEnergy || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Engagement: Active Listening Gestures</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Speaking Sync: Mouth Activity {liveMetrics?.mouthActivity || 0}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Body Language: {liveMetrics?.postureState || 'Monitoring'}</span>
                  </div>
                </div>
              </div>

              {/* Uncertainty Flags */}
              {currentReportSnapshot?.diagnostics?.uncertaintyFlags &&
                currentReportSnapshot.diagnostics.uncertaintyFlags.length > 0 && (
                  <div className="p-3 bg-amber-950/40 rounded-lg border border-amber-800/40 text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Uncertainty & Calibration Notice</span>
                    </div>
                    {currentReportSnapshot.diagnostics.uncertaintyFlags.map((flag, idx) => (
                      <p key={idx} className="text-[11px] text-amber-300/90 leading-relaxed pl-5">
                        • {flag}
                      </p>
                    ))}
                  </div>
                )}

              {/* Live Audit Log Stream */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-xs">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Analyzer Engine Audit & Detection Trail</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Chronological stream</span>
                </div>

                <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 font-mono text-[10px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
                  {currentReportSnapshot?.diagnostics?.diagnosticAudit &&
                  currentReportSnapshot.diagnostics.diagnosticAudit.length > 0 ? (
                    currentReportSnapshot.diagnostics.diagnosticAudit.map((log, i) => (
                      <div
                        key={i}
                        className={`leading-relaxed ${
                          log.includes('WARNING')
                            ? 'text-amber-400'
                            : log.includes('EVIDENCE')
                            ? 'text-cyan-400 font-medium'
                            : log.includes('START') || log.includes('STOP')
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic">No audit logs recorded yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>All biometric frames are calculated on-device without server-side video streaming.</span>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-medium transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
