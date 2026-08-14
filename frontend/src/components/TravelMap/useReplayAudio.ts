import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cockpit ambience for the replay (2026-08-14), fully synthesized —
 * no audio assets, no licensing, nothing in the bundle:
 *
 * - Airport-lounge pad: warm chords (triangle voices, slow attack, long
 *   release, slight detune) cycling a four-chord loop over a soft mid-low
 *   bed. The first cut was a 110Hz rumble — physically inaudible on
 *   phone/laptop speakers, which is why it read as "just a beep".
 * - Seatbelt chime: hi–lo two-tone, filtered soft, per arrival.
 *
 * Everything runs through one master gain; mute ramps it, so the toggle
 * is instant and the graph stays alive. The AudioContext is created
 * inside the Play click's gesture window (autoplay policy). Sound is on
 * by default, quiet; the mute lives in the replay bar and is remembered.
 */

const MUTE_KEY = 'contrail:replay-muted';

/** Warm lounge loop: Fmaj7 → Cmaj9 → Am7 → G6, mid register. */
const CHORDS: number[][] = [
  [174.61, 220.0, 261.63, 329.63],
  [130.81, 164.81, 196.0, 293.66],
  [110.0, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 329.63],
];
const CHORD_EVERY_S = 6;
const CHORD_LENGTH_S = 9;
const NOTE_GAIN = 0.016;
const BED_GAIN = 0.022;
const CHIME_GAIN = 0.05;

interface Ambience {
  stop: () => void;
}

function startAmbience(ctx: AudioContext, out: AudioNode): Ambience {
  // The bed: two barely-detuned sines around 174Hz — present on small
  // speakers, felt more than heard on good ones.
  const bedGain = ctx.createGain();
  bedGain.gain.setValueAtTime(0, ctx.currentTime);
  bedGain.gain.linearRampToValueAtTime(BED_GAIN, ctx.currentTime + 2);
  bedGain.connect(out);
  const bedOscs = [174, 174.7].map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(bedGain);
    osc.start();
    return osc;
  });

  // The pad: one chord every few seconds, overlapping into a wash.
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1100;
  padFilter.connect(out);

  let chordIndex = 0;
  const playChord = () => {
    const start = ctx.currentTime + 0.05;
    for (const freq of CHORDS[chordIndex % CHORDS.length]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      // ±4 cents of drift keeps it organic rather than organ-like.
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.0046);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(NOTE_GAIN, start + 2.5);
      gain.gain.setValueAtTime(NOTE_GAIN, start + CHORD_LENGTH_S - 3.5);
      gain.gain.linearRampToValueAtTime(0, start + CHORD_LENGTH_S);
      osc.connect(gain).connect(padFilter);
      osc.start(start);
      osc.stop(start + CHORD_LENGTH_S + 0.1);
    }
    chordIndex += 1;
  };
  playChord();
  const interval = window.setInterval(playChord, CHORD_EVERY_S * 1000);

  return {
    stop: () => {
      window.clearInterval(interval);
      const now = ctx.currentTime;
      bedGain.gain.cancelScheduledValues(now);
      bedGain.gain.setValueAtTime(bedGain.gain.value, now);
      bedGain.gain.linearRampToValueAtTime(0, now + 0.8);
      for (const osc of bedOscs) osc.stop(now + 1);
      // Pad voices carry their own envelopes to zero; the filter node is
      // abandoned to the graph's garbage collection once they end.
    },
  };
}

function playChime(ctx: AudioContext, out: AudioNode): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.connect(out);
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
    gain.gain.linearRampToValueAtTime(CHIME_GAIN, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(gain).connect(filter);
    osc.start(start);
    osc.stop(start + 1.2);
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
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const ambienceRef = useRef<Ambience | null>(null);

  const ensureGraph = useCallback((): {
    ctx: AudioContext;
    master: GainNode;
  } | null => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
        masterRef.current = ctxRef.current.createGain();
        masterRef.current.gain.value = mutedRef.current ? 0 : 1;
        masterRef.current.connect(ctxRef.current.destination);
      } catch {
        return null; // no WebAudio; the replay simply stays silent
      }
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return { ctx: ctxRef.current, master: masterRef.current! };
  }, []);

  useEffect(() => {
    if (replayActive) {
      const graph = ensureGraph();
      if (graph && !ambienceRef.current) {
        ambienceRef.current = startAmbience(graph.ctx, graph.master);
      }
    }
    return () => {
      ambienceRef.current?.stop();
      ambienceRef.current = null;
    };
  }, [replayActive, ensureGraph]);

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
      const master = masterRef.current;
      const ctx = ctxRef.current;
      if (master && ctx) {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(next ? 0 : 1, now + 0.3);
      }
      return next;
    });
  }, []);

  const chime = useCallback(() => {
    if (mutedRef.current) return;
    const graph = ensureGraph();
    if (graph) playChime(graph.ctx, graph.master);
  }, [ensureGraph]);

  return { muted, toggleMuted, chime };
}
