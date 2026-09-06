import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API interface declarations
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as IWindow).SpeechRecognition ||
        (window as unknown as IWindow).webkitSpeechRecognition
    );

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    isRunningRef.current = false;
    setIsListening(false);
    setInterimTranscript('');

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setInterimTranscript('');
    shouldListenRef.current = true;

    // Explicitly check & trigger browser mic permission prompt if needed
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release immediate test track; continuous audio handled by Web Audio
        stream.getTracks().forEach((t) => t.stop());
      } catch (micErr: any) {
        if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
          setError('Microphone permission was denied. Please allow microphone access in your browser.');
          shouldListenRef.current = false;
          setIsListening(false);
          return;
        }
      }
    }

    if (!isSupported) {
      setError('Web Speech Recognition is not supported by this browser. Live audio waveform and delivery metrics are active.');
      setIsListening(true);
      return;
    }

    try {
      const SpeechRecognition =
        (window as unknown as IWindow).SpeechRecognition ||
        (window as unknown as IWindow).webkitSpeechRecognition;

      // Clean up previous instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        isRunningRef.current = true;
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript.trim() + ' ';
          } else {
            currentInterim += item[0].transcript.trim();
          }
        }

        if (currentFinal) {
          setTranscript(currentFinal.trim());
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        const errType = event.error;
        console.warn('Speech recognition event warning:', errType);

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          setError('Microphone permission was denied. Please allow microphone access.');
          shouldListenRef.current = false;
          setIsListening(false);
        } else if (errType === 'no-speech') {
          // Benign pause in speech; do not abort listening
        } else if (errType === 'network') {
          setError('Speech Recognition cloud service is unreachable. Realtime vocal telemetry and waveforms remain active.');
        }
      };

      recognition.onend = () => {
        isRunningRef.current = false;

        // If user hasn't explicitly clicked stop, cycle and restart cleanly
        if (shouldListenRef.current) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldListenRef.current && !isRunningRef.current) {
              try {
                recognition.start();
              } catch {
                setIsListening(false);
              }
            }
          }, 150);
        } else {
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Speech recognition start error:', err);
      setIsListening(true);
    }
  }, [isSupported]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      isRunningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    setTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported,
  };
}
