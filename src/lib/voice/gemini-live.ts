import {
  PCM_SAMPLE_RATE,
  calculateVolume,
  createBlob,
  decodeAudioData,
  decodeBase64,
  encodeBase64,
} from './audio-utils';

export type GeminiConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface GeminiFunctionCall {
  id?: string;
  name: string;
  arguments: Record<string, any>;
}

export interface GeminiLiveCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAudio?: (buffer: AudioBuffer) => void;
  onVolume?: (volume: number) => void;
  onToolCall?: (call: GeminiFunctionCall) => Promise<any> | void;
  onConnectionChange?: (state: GeminiConnectionState) => void;
  onError?: (error: Error) => void;
  onToolResultAck?: (callId: string) => void;
}

export interface GeminiLiveOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  debug?: boolean;
  callbacks?: GeminiLiveCallbacks;
}

/**
 * Browser-only Gemini Live client with WebRTC/WebSocket audio transport.
 * Handles microphone capture, bidirectional audio, and function call bridging.
 */
export class GeminiLiveClient {
  private audioContext?: AudioContext;
  private mediaStream?: MediaStream;
  private processor?: ScriptProcessorNode;
  private socket?: WebSocket;
  private state: GeminiConnectionState = 'idle';
  private readonly callbacks: GeminiLiveCallbacks;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly endpoint?: string;
  private readonly debug?: boolean;

  constructor(options: GeminiLiveOptions = {}) {
    this.callbacks = options.callbacks || {};
    this.model = options.model || 'gemini-1.5-pro-latest';
    this.apiKey = options.apiKey;
    this.endpoint =
      options.endpoint ||
      (this.apiKey
        ? `wss://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}`
        : undefined);
    this.debug = options.debug;
  }

  get connectionState(): GeminiConnectionState {
    return this.state;
  }

  /**
  * Start microphone capture and open Gemini Live transport.
  */
  async connect() {
    if (typeof window === 'undefined') {
      throw new Error('Gemini Live client must be used in the browser');
    }

    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    try {
      await this.startAudioPipeline();
      await this.openSocket();
      this.setState('connected');
    } catch (error: any) {
      this.setState('disconnected');
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(error?.message || 'Gemini Live connection error')
      );
      throw error;
    }
  }

  /**
   * Stop capture and close transport.
   */
  disconnect() {
    this.setState('disconnected');

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = undefined;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = undefined;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = undefined;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
  }

  /**
   * Send a tool/function call result back to Gemini.
   */
  sendToolResult(callId: string, result: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: 'function_result',
      callId,
      result,
    };
    this.socket.send(JSON.stringify(payload));
  }

  private setState(next: GeminiConnectionState) {
    this.state = next;
    this.callbacks.onConnectionChange?.(next);
  }

  private async startAudioPipeline() {
    const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextCtor({ sampleRate: PCM_SAMPLE_RATE });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: PCM_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    if (!this.mediaStream || !this.audioContext) {
      throw new Error('Failed to initialize audio pipeline');
    }

    // Local references for TypeScript type narrowing
    const mediaStream = this.mediaStream;
    const audioContext = this.audioContext;
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    const gain = audioContext.createGain();
    // Avoid feedback loop: mute the monitoring chain
    gain.gain.value = 0;

    this.processor = audioContext.createScriptProcessor(4096, 1, 1);
    source.connect(this.processor);
    this.processor.connect(gain);
    gain.connect(audioContext.destination);

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const input = event.inputBuffer.getChannelData(0);
      this.callbacks.onVolume?.(calculateVolume(input));
      this.sendAudioChunk(input);
    };
  }

  private async openSocket() {
    if (!this.endpoint) {
      throw new Error('Gemini Live endpoint or API key missing');
    }

    this.socket = new WebSocket(this.endpoint);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {
      // Initial configuration for the model / audio stream
      const config = {
        type: 'start',
        model: this.model,
        audio: { sampleRate: PCM_SAMPLE_RATE, encoding: 'LINEAR16' },
      };
      this.socket?.send(JSON.stringify(config));
    };

    this.socket.onmessage = (event) => this.handleMessage(event.data);

    this.socket.onerror = (event) => {
      this.callbacks.onError?.(new Error('Gemini Live WebSocket error'));
      if (this.debug) console.warn('Gemini Live socket error', event);
    };

    this.socket.onclose = () => {
      this.setState('disconnected');
    };
  }

  private async sendAudioChunk(samples: Float32Array) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const blob = createBlob(samples);
    const buffer = await blob.arrayBuffer();
    const payload = {
      type: 'audio',
      data: encodeBase64(new Uint8Array(buffer)),
    };
    this.socket.send(JSON.stringify(payload));
  }

  private async handleMessage(message: string | ArrayBuffer) {
    try {
      if (message instanceof ArrayBuffer) {
        // Binary audio fallback
        const audioBuffer = await decodeAudioData(new Uint8Array(message));
        this.callbacks.onAudio?.(audioBuffer);
        this.playAudio(audioBuffer);
        return;
      }

      const payload = JSON.parse(message);

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.debug('[Gemini Live] message', payload);
      }

      switch (payload.type) {
        case 'transcript': {
          this.callbacks.onTranscript?.(payload.text || '', !!payload.isFinal);
          break;
        }
        case 'audio': {
          if (!payload.data) break;
          const bytes = decodeBase64(payload.data);
          const audioBuffer = await decodeAudioData(bytes);
          this.callbacks.onAudio?.(audioBuffer);
          this.playAudio(audioBuffer);
          break;
        }
        case 'function_call': {
          const call: GeminiFunctionCall = {
            id: payload.id || payload.callId,
            name: payload.name,
            arguments: payload.arguments || payload.args || {},
          };
          if (this.callbacks.onToolCall) {
            const result = await this.callbacks.onToolCall(call);
            if (call.id && result !== undefined) {
              this.sendToolResult(call.id, result);
            }
          }
          break;
        }
        case 'function_result_ack': {
          if (payload.callId) {
            this.callbacks.onToolResultAck?.(payload.callId);
          }
          break;
        }
        default:
          break;
      }
    } catch (error: any) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(error?.message || 'Gemini message handling error')
      );
    }
  }

  private async playAudio(audioBuffer: AudioBuffer) {
    if (!this.audioContext) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }
}
