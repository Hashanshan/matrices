/**
 * Background Sync & Keep-Alive Permission Handler
 * Keeps network downloads active even when the phone screen is locked or app is minimized,
 * and manages background data keep-alive for uninterrupted catalogue downloading.
 */

export interface BackgroundPermissionResult {
  granted: boolean;
  message: string;
}

class BackgroundKeepAliveEngine {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isRunning = false;

  public start(): void {
    if (this.isRunning || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      
      // Gain set to 0.00001 (completely inaudible silence)
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0.00001;

      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.value = 440;

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.oscillator.start();
      this.isRunning = true;
    } catch (e) {
      console.warn('BackgroundKeepAlive audio session notice:', e);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;
    try {
      this.oscillator?.stop();
      this.oscillator?.disconnect();
      this.gainNode?.disconnect();
      this.audioCtx?.close();
    } catch {}
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.isRunning = false;
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveEngine();

export async function checkBackgroundPermission(): Promise<BackgroundPermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  return {
    granted: true,
    message: 'Background keep-awake & lock-screen download engine ready.',
  };
}

export async function requestBackgroundPermission(): Promise<BackgroundPermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  return {
    granted: true,
    message: 'Background data keep-alive active for uninterrupted catalogue sync.',
  };
}
