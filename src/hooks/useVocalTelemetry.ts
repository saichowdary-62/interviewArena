import { useState, useEffect, useRef, useCallback } from 'react';
import { DeliveryTelemetry } from '../types';

const FILLER_PATTERNS = /\b(um|uh|erm|ah|like|you know|basically|actually|literally|so yeah|sort of|kind of|i mean)\b/gi;

interface UseVocalTelemetryProps {
  isRecording: boolean;
  transcript: string;
}

export function useVocalTelemetry({ isRecording, transcript }: UseVocalTelemetryProps) {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingTimeSeconds, setSpeakingTimeSeconds] = useState<number>(0);
  const [silenceTimeSeconds, setSilenceTimeSeconds] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(false);

  // Eye contact & posture state updated from webcam frame analyzer
  const [eyeContactPct, setEyeContactPct] = useState<number>(88);
  const [eyeContactStatus, setEyeContactStatus] = useState<DeliveryTelemetry['eyeContactStatus']>('Direct Eye Contact');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speechIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Request & initialize microphone stream with Web Audio Analyser
  const initMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Microphone API is not supported in this browser.');
      return null;
    }

    try {
      // Release prior stream if existing
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      // Try with voice-optimized constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err1) {
        // Fallback to basic audio
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;
      setHasMicPermission(true);
      setMicError(null);

      // Initialize Web Audio Context
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // Resume context if suspended (browser autoplay policy requirement)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      return stream;
    } catch (err: any) {
      console.warn('Microphone initialization error:', err);
      setHasMicPermission(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicError('Microphone permission was denied. Please allow microphone access in your browser.');
      } else if (err?.name === 'NotFoundError') {
        setMicError('No microphone hardware detected on this device.');
      } else {
        setMicError('Unable to access microphone: ' + (err?.message || 'Check browser permissions.'));
      }
      return null;
    }
  }, []);

  // Teardown microphone stream & audio context
  const stopMicrophone = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

  // When recording state changes, start or stop microphone
  useEffect(() => {
    let isCancelled = false;

    if (isRecording) {
      initMicrophone().then((stream) => {
        if (isCancelled || !stream) return;

        // Audio analysis render loop
        const dataArray = new Uint8Array(analyserRef.current ? analyserRef.current.frequencyBinCount : 64);

        const analyzeAudio = () => {
          if (!analyserRef.current || !mediaStreamRef.current) return;

          // Resume audio context if it went into suspended state
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }

          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate RMS volume level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const normalizedLevel = Math.min(100, Math.round((rms / 128) * 100));

          setAudioLevel(normalizedLevel);

          // Vocal activity threshold (>12% level considered active vocal delivery)
          const currentlySpeaking = normalizedLevel > 12;
          setIsSpeaking(currentlySpeaking);
          isSpeakingRef.current = currentlySpeaking;

          animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        };

        analyzeAudio();
      });

      // Track active speaking vs pause time in seconds
      speechIntervalRef.current = setInterval(() => {
        if (isSpeakingRef.current) {
          setSpeakingTimeSeconds((prev) => prev + 1);
        } else {
          setSilenceTimeSeconds((prev) => prev + 1);
        }
      }, 1000);
    } else {
      stopMicrophone();
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
        speechIntervalRef.current = null;
      }
    }

    return () => {
      isCancelled = true;
      stopMicrophone();
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
      }
    };
  }, [isRecording, initMicrophone, stopMicrophone]);

  // Compute live word count & WPM
  const words = transcript ? transcript.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  let wpm = 0;
  let wpmStatus: DeliveryTelemetry['wpmStatus'] = 'Calibrating';

  // Calculate WPM using speaking time or elapsed duration
  const activeDuration = Math.max(1, speakingTimeSeconds);
  if (wordCount > 0 && activeDuration >= 3) {
    wpm = Math.round((wordCount / activeDuration) * 60);
    if (wpm < 110) {
      wpmStatus = 'Slow';
    } else if (wpm <= 165) {
      wpmStatus = 'Optimal';
    } else {
      wpmStatus = 'Fast';
    }
  } else if (wordCount > 0) {
    wpmStatus = 'Calibrating';
  } else {
    wpm = 0;
    wpmStatus = isRecording ? 'Calibrating' : 'Optimal';
  }

  // Detect verbal filler words dynamically
  const matches = transcript.match(FILLER_PATTERNS) || [];
  const fillersCount = matches.length;
  const detectedFillers = Array.from(new Set(matches.map((f) => f.toLowerCase())));

  // Compute Clarity score (based on filler density per 100 words)
  let clarityPct = 95;
  let clarityStatus: DeliveryTelemetry['clarityStatus'] = 'High';

  if (wordCount > 5) {
    const fillerRatio = (fillersCount / wordCount) * 100;
    if (fillerRatio <= 2.5) {
      clarityPct = Math.max(88, 96 - Math.round(fillerRatio * 2));
      clarityStatus = 'High';
    } else if (fillerRatio <= 6.0) {
      clarityPct = Math.max(74, 88 - Math.round((fillerRatio - 2.5) * 4));
      clarityStatus = 'Good';
    } else {
      clarityPct = Math.max(55, 74 - Math.round((fillerRatio - 6) * 3));
      clarityStatus = 'Needs Polish';
    }
  }

  const updateEyeContact = useCallback((pct: number, status: DeliveryTelemetry['eyeContactStatus']) => {
    setEyeContactPct(pct);
    setEyeContactStatus(status);
  }, []);

  const telemetry: DeliveryTelemetry = {
    wpm,
    wpmStatus,
    eyeContactPct,
    eyeContactStatus,
    clarityPct,
    clarityStatus,
    fillersCount,
    detectedFillers,
    audioLevel,
    isSpeaking,
    speakingTimeSeconds,
    silenceTimeSeconds,
  };

  return {
    telemetry,
    audioLevel,
    isSpeaking,
    hasMicPermission,
    micError,
    requestMicPermission: initMicrophone,
    updateEyeContact,
    audioStream: mediaStreamRef.current,
    analyserNode: analyserRef.current,
  };
}
