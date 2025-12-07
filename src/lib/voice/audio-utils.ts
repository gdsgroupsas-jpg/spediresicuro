/**
 * Audio utility helpers for Gemini Live
 *
 * - Converts Web Audio Float32Array buffers to 16-bit PCM blobs
 * - Decodes PCM responses to AudioBuffer for playback
 * - Base64 helpers for transport
 */

export const PCM_SAMPLE_RATE = 16_000;

/**
 * Convert Float32 audio samples (-1..1) to signed 16-bit PCM.
 */
export function float32ToPCM16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return pcm;
}

/**
 * Create a PCM Blob suitable for WebSocket transport.
 * Output: mono, 16-bit little-endian, 16 kHz.
 */
export function createBlob(samples: Float32Array, sampleRate: number = PCM_SAMPLE_RATE): Blob {
  const pcm = float32ToPCM16(samples);
  const buffer = new ArrayBuffer(pcm.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(i * 2, pcm[i], true);
  }

  return new Blob([buffer], { type: `audio/pcm;rate=${sampleRate}` });
}

/**
 * Decode PCM bytes returned by Gemini into an AudioBuffer for playback.
 * Falls back to manual PCM -> Float32 conversion if decodeAudioData fails.
 */
export async function decodeAudioData(
  data: Uint8Array,
  sampleRate: number = PCM_SAMPLE_RATE
): Promise<AudioBuffer> {
  if (typeof window === 'undefined') {
    throw new Error('Audio decoding available only in browser');
  }

  const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioContext: AudioContext = new AudioContextCtor({ sampleRate });

  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

  try {
    return await audioContext.decodeAudioData(buffer.slice(0));
  } catch (error) {
    // Fallback: manual PCM decode to mono buffer
    const view = new DataView(buffer);
    const float = new Float32Array(view.byteLength / 2);
    for (let i = 0; i < float.length; i++) {
      float[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    const audioBuffer = audioContext.createBuffer(1, float.length, sampleRate);
    audioBuffer.copyToChannel(float, 0);
    return audioBuffer;
  }
}

/**
 * Encode bytes to base64 (browser-safe).
 */
export function encodeBase64(input: Uint8Array | ArrayBuffer | string): string {
  if (typeof input === 'string') return btoa(input);

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode base64 string to Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute RMS volume for simple waveform visualization.
 */
export function calculateVolume(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Helper to normalize PCM Int16 data to Float32 (-1..1).
 */
export function pcm16ToFloat32(data: Int16Array): Float32Array {
  const float = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    float[i] = data[i] / 0x8000;
  }
  return float;
}
