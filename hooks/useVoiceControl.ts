import { useCallback, useEffect, useRef, useState } from 'react';
import { GeminiLiveClient } from '@/lib/voice';
import { executeVoiceTool, voiceFunctionDeclarations } from '@/lib/voice';

export interface UseVoiceControlOptions {
  api?: any; // tRPC client proxy (optional)
  apiKey?: string;
  model?: string;
  endpoint?: string;
  userId?: string;
  userRole?: 'admin' | 'user';
  fetcher?: typeof fetch;
  onError?: (error: Error) => void;
  debug?: boolean;
}

export function useVoiceControl(options: UseVoiceControlOptions = {}) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const latestFinalTranscript = useRef('');
  const clientRef = useRef<GeminiLiveClient | null>(null);

  const executeTool = useCallback(
    async (name: string, args: any) => {
      return executeVoiceTool(name, args, {
        api: options.api,
        fetcher: options.fetcher,
        userId: options.userId,
        role: options.userRole || 'user',
      });
    },
    [options.api, options.fetcher, options.userId, options.userRole]
  );

  const startSession = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setIsConnecting(true);
    try {
      clientRef.current?.disconnect();

      clientRef.current = new GeminiLiveClient({
        apiKey: options.apiKey,
        model: options.model,
        endpoint: options.endpoint,
        debug: options.debug,
        callbacks: {
          onTranscript: (text, isFinal) => {
            if (isFinal) {
              latestFinalTranscript.current = `${latestFinalTranscript.current} ${text}`.trim();
              setTranscript(latestFinalTranscript.current);
            } else {
              setTranscript(`${latestFinalTranscript.current} ${text}`.trim());
            }
          },
          onVolume: (value) => setVolume(value),
          onToolCall: async (call) => {
            const result = await executeTool(call.name, call.arguments);
            return { ...result, toolName: call.name };
          },
          onError: (error) => {
            options.onError?.(error);
          },
        },
      });

      await clientRef.current.connect();
      setIsActive(true);
    } catch (error: any) {
      options.onError?.(
        error instanceof Error ? error : new Error(error?.message || 'Voice session error')
      );
      setIsActive(false);
    } finally {
      setIsConnecting(false);
    }
  }, [
    executeTool,
    options.apiKey,
    options.debug,
    options.endpoint,
    options.model,
    options.onError,
  ]);

  const stopSession = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsActive(false);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return {
    isActive,
    isConnecting,
    volume,
    transcript,
    startSession,
    stopSession,
    executeTool,
    tools: voiceFunctionDeclarations,
  };
}
