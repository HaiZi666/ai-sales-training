'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface AutoStopOnSilenceOptions {
  /** 检测到说话后的连续静音达到该时长则自动停止（毫秒） */
  silenceDurationMs?: number;
  /** 音量 RMS 阈值，低于视为静音（约 0.015–0.03，视环境噪声调整） */
  amplitudeThreshold?: number;
  /** 至少录制多久后才允许自动停，避免刚点开就误触发 */
  minRecordingMs?: number;
  /** 自动停止并得到录音 Blob 后回调（与手动 stopRecording 结果一致） */
  onComplete: (blob: Blob | null) => void;
}

export interface StartRecordingOptions {
  autoStopOnSilence?: AutoStopOnSilenceOptions;
}

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isPlaying: boolean;
  audioUrl: string | null;
  duration: number;
  startRecording: (options?: StartRecordingOptions) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  playAudio: (url: string) => void;
  stopPlaying: () => void;
  error: string | null;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const silenceAudioContextRef = useRef<AudioContext | null>(null);
  const silenceStoppingRef = useRef(false);

  const cleanupSilenceDetection = useCallback(() => {
    if (silenceRafRef.current != null) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (silenceAudioContextRef.current) {
      try {
        void silenceAudioContextRef.current.close();
      } catch {
        /* ignore */
      }
      silenceAudioContextRef.current = null;
    }
    silenceStoppingRef.current = false;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      cleanupSilenceDetection();
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [audioUrl, cleanupSilenceDetection]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    cleanupSilenceDetection();
    return new Promise(resolve => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const rec = mediaRecorderRef.current;
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsRecording(false);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        resolve(blob);
      };

      rec.stop();
    });
  }, [cleanupSilenceDetection]);

  const startRecording = useCallback(
    async (options?: StartRecordingOptions) => {
      try {
        setError(null);
        cleanupSilenceDetection();
        audioChunksRef.current = [];
        setDuration(0);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const preferredMimes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
        ];
        const mimeType = preferredMimes.find(m => MediaRecorder.isTypeSupported(m)) || '';

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);

        const silenceOpts = options?.autoStopOnSilence;
        if (silenceOpts) {
          const silenceDurationMs = silenceOpts.silenceDurationMs ?? 1500;
          const amplitudeThreshold = silenceOpts.amplitudeThreshold ?? 0.024;
          const minRecordingMs = silenceOpts.minRecordingMs ?? 600;
          const { onComplete } = silenceOpts;

          const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AudioCtx) {
            return;
          }

          const audioContext = new AudioCtx();
          silenceAudioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.2;
          source.connect(analyser);

          const data = new Uint8Array(analyser.fftSize);
          const startedAt = performance.now();
          let lastVoiceAt = performance.now();
          let hasSpeech = false;

          const tick = () => {
            if (silenceStoppingRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
              return;
            }

            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);

            const now = performance.now();
            if (rms > amplitudeThreshold) {
              hasSpeech = true;
              lastVoiceAt = now;
            } else if (hasSpeech && now - startedAt >= minRecordingMs && now - lastVoiceAt >= silenceDurationMs) {
              silenceStoppingRef.current = true;
              if (silenceRafRef.current != null) {
                cancelAnimationFrame(silenceRafRef.current);
                silenceRafRef.current = null;
              }
              try {
                void audioContext.close();
              } catch {
                /* ignore */
              }
              silenceAudioContextRef.current = null;
              void stopRecording().then(onComplete);
              return;
            }

            silenceRafRef.current = requestAnimationFrame(tick);
          };

          silenceRafRef.current = requestAnimationFrame(tick);
        }
      } catch (err) {
        setError('无法访问麦克风，请检查权限设置');
        console.error('Recording error:', err);
      }
    },
    [cleanupSilenceDetection, stopRecording]
  );

  const playAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setError('音频播放失败');
    };

    audio.play().catch(() => {
      setError('音频播放失败');
    });
  }, []);

  const stopPlaying = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  return {
    isRecording,
    isPlaying,
    audioUrl,
    duration,
    startRecording,
    stopRecording,
    playAudio,
    stopPlaying,
    error,
  };
}
