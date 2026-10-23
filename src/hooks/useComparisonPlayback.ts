import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArenaPreparedPair } from "../types/arena";
import type { GhostAction } from "../types/ghost";
import { alignDtw } from "../lib/arena/dtw";
import { prepareArenaPair } from "../lib/arena/normalize";
import {
  createComparisonSampler,
  type ComparisonFrame,
  type ComparisonMode,
  type ComparisonSampler,
} from "../lib/arena/arenaPlayback";

export function useComparisonPlayback(
  actionA: GhostAction | null,
  actionB: GhostAction | null,
) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<ComparisonMode>("original");
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState<ComparisonFrame | null>(null);
  const [selectedJoint, setSelectedJoint] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const pair: ArenaPreparedPair | null = useMemo(() => {
    if (!actionA || !actionB) return null;
    return prepareArenaPair(actionA, actionB, alignDtw);
  }, [actionA, actionB]);

  const samplerRef = useRef<ComparisonSampler | null>(null);

  useEffect(() => {
    if (!actionA || !actionB || !pair) {
      samplerRef.current = null;
      setFrame(null);
      return;
    }
    samplerRef.current = createComparisonSampler(
      actionA,
      actionB,
      mode,
      pair.refFrames,
      pair.imitFrames,
      pair.alignment,
    );
    setFrame(samplerRef.current(0));
    setProgress(0);
  }, [actionA, actionB, mode, pair]);

  const seek = useCallback((p: number) => {
    const clamped = Math.min(1, Math.max(0, p));
    setProgress(clamped);
    if (samplerRef.current) setFrame(samplerRef.current(clamped));
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      return;
    }
    const sampler = samplerRef.current;
    if (!sampler || sampler.durationMs <= 0) return;
    lastTimeRef.current = 0;

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = (now - lastTimeRef.current) * speed;
      lastTimeRef.current = now;
      const dp = dt / sampler.durationMs;
      setProgress((prev) => {
        const next = prev + dp;
        if (next >= 1) {
          setPlaying(false);
          setFrame(sampler(1));
          return 1;
        }
        setFrame(sampler(next));
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const restart = useCallback(() => { setPlaying(false); seek(0); }, [seek]);
  const toggleMode = useCallback(() => {
    setPlaying(false);
    setMode((m: ComparisonMode) => (m === "original" ? "dtw" : "original"));
  }, []);

  const jumpToMoment = useCallback((ms: number) => {
    const sampler = samplerRef.current;
    if (!sampler || sampler.durationMs <= 0) return;
    seek(ms / sampler.durationMs);
  }, [seek]);

  return {
    playing, progress, mode, speed, frame, selectedJoint,
    play, pause, restart, seek, setSpeed, toggleMode, setSelectedJoint,
    jumpToMoment, pair,
  };
}