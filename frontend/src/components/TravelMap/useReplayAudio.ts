import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cockpit ambience for the replay (2026-08-14), fully synthesized —
 * no audio assets, no licensing, nothing in the bundle:
 *
 * - Engine hum: a looped noise buffer through a low-pass filter at a very
 *   low gain. Runs while the replay is active and unmuted.
 * - Seatbelt chime: the classic hi–lo two-tone, fired per arrival.
 *
 * The AudioContext is created on first use, which happens inside the Play
 * click's gesture window — that is what satisfies autoplay policy. Mute is
 * remembered across sessions; sound is on by default (owner decision:
 * the ambience is the delight, and the mute is one tap away).
 */

const MUTE_KEY = 'contrail:replay-muted';
const HUM_GAIN = 0.035;
const CHIME_GAIN = 0.08;

function createHum(ctx: AudioContext): { stop: () => void } {
  // Two seconds of noise, looped — indistinguishable from endless.
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Brown-ish noise: integrate white noise so the rumble sits low.
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 110;

  const gain = ctx.createGain();
  // Fade in over a second — an engine spooling up, not a switch.
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(HUM_GAIN, ctx.currentTime + 1.2);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();

  return {
    stop: () => {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      source.stop(now + 0.6);
    },
  };
}

function playChime(ctx: AudioContext): void {
  // Hi then lo, soft attack, long release — the cabin "ding-dong".
  const notes: [number, number][] = [
    [830, 0],
    [622, 0.28],
  ];
  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(CHIME_GAIN, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1);
  }
}

export function useReplayAudio(replayActive: boolean): {
  muted: boolean;
  toggleMuted: () => void;
  chime: () => void;
} {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const ctxRef = useRef<AudioContext | null>(null);
  const humRef = useRef<{ stop: () => void } | null>(null);

  const ensureContext = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch {
        return null; // no WebAudio; the replay simply stays silent
      }
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // The hum follows (active && !muted); everything else is cleanup.
  useEffect(() => {
    if (replayActive && !muted) {
      const ctx = ensureContext();
      if (ctx && !humRef.current) {
        humRef.current = createHum(ctx);
      }
    }
    return () => {
      humRef.current?.stop();
      humRef.current = null;
    };
  }, [replayActive, muted, ensureContext]);

  // Release the device's audio session when the component goes away.
  useEffect(
    () => () => {
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    },
    [],
  );

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* private browsing: the choice lasts the session */
      }
      return next;
    });
  }, []);

  const chime = useCallback(() => {
    if (muted) return;
    const ctx = ensureContext();
    if (ctx) playChime(ctx);
  }, [muted, ensureContext]);

  return { muted, toggleMuted, chime };
}
