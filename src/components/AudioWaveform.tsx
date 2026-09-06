import React, { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  isRecording: boolean;
  onAudioLevelChange?: (level: number) => void;
  analyser?: AnalyserNode | null;
  audioLevel?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  onAudioLevelChange,
  analyser: externalAnalyser,
  audioLevel: externalAudioLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [hasMicrophone, setHasMicrophone] = useState<boolean>(false);

  // If no external analyser was provided, initialize standalone mic capture
  useEffect(() => {
    let active = true;

    if (externalAnalyser) {
      setHasMicrophone(true);
      return;
    }

    async function initMicrophone() {
      if (!isRecording) {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        setHasMicrophone(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        internalAnalyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        setHasMicrophone(true);
      } catch (err) {
        setHasMicrophone(false);
      }
    }

    initMicrophone();

    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, externalAnalyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const effectiveAnalyser = externalAnalyser || internalAnalyserRef.current;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 32;
      const barWidth = 3;
      const gap = (width - numBars * barWidth) / (numBars - 1);
      const centerY = height / 2;

      let frequencyData: Uint8Array | null = null;
      if (isRecording && effectiveAnalyser) {
        frequencyData = new Uint8Array(effectiveAnalyser.frequencyBinCount);
        effectiveAnalyser.getByteFrequencyData(frequencyData);
      }

      let totalEnergy = 0;

      for (let i = 0; i < numBars; i++) {
        let normalizedVal = 0.08;

        if (isRecording) {
          if (frequencyData && frequencyData.length > 0) {
            const dataIndex = Math.floor((i / numBars) * frequencyData.length);
            const rawVal = frequencyData[dataIndex] / 255;
            normalizedVal = Math.max(0.12, Math.min(1.0, rawVal * 1.4));
          } else if (externalAudioLevel !== undefined && externalAudioLevel > 0) {
            const wave = Math.sin(phase * 0.1 + i * 0.3);
            normalizedVal = Math.max(0.12, (externalAudioLevel / 100) * (0.6 + 0.4 * wave));
          } else {
            // Ambient standby ripple
            const wave1 = Math.sin(phase * 0.05 + i * 0.35);
            normalizedVal = Math.max(0.1, (wave1 + 1) * 0.15);
          }
        }

        totalEnergy += normalizedVal;

        const barHeight = Math.max(4, normalizedVal * (height - 6));
        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        // Visual design: crisp solid slate & blue
        if (isRecording) {
          ctx.fillStyle = normalizedVal > 0.4 ? '#2563EB' : '#60A5FA';
        } else {
          ctx.fillStyle = '#CBD5E1';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
      }

      phase++;

      if (onAudioLevelChange && isRecording) {
        const computedLevel = Math.min(100, Math.round((totalEnergy / numBars) * 100));
        onAudioLevelChange(computedLevel);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, externalAnalyser, externalAudioLevel, hasMicrophone, onAudioLevelChange]);

  return (
    <div className="flex items-center gap-3">
      <canvas
        ref={canvasRef}
        width={160}
        height={30}
        className="w-[160px] h-[30px] block"
      />
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span
          className={`w-2 h-2 rounded-full ${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-300'
          }`}
        />
        <span className={isRecording ? 'text-red-700 font-bold' : 'text-slate-500'}>
          {isRecording ? 'Mic Active' : 'Mic Standby'}
        </span>
      </div>
    </div>
  );
};
