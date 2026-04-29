"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Hls from "hls.js";

// ─── Types ──────────────────────────────────────────────

export type VideoEvent =
  | "started"
  | "paused"
  | "resumed"
  | "milestone"
  | "completed"
  | "abandoned";

export type VideoEventPayload = {
  event: VideoEvent;
  currentTime: number;
  duration: number;
  percentWatched: number;
  totalWatchTime: number;
  milestone?: number; // 25, 50, 75, 100
};

type VideoPlayerProps = {
  /** Direct video URL (mp4, webm, etc.) */
  src: string;
  /** Optional poster/thumbnail image */
  poster?: string;
  /** Callback fired on every trackable event */
  onVideoEvent?: (payload: VideoEventPayload) => void;
  /** Periodic watch-time callback in seconds (throttled, for UI gating) */
  onWatchTime?: (seconds: number) => void;
  /** URL for sendBeacon abandon tracking (POST JSON payload on page leave) */
  abandonBeaconUrl?: string;
  /** Extra data merged into the beacon body */
  abandonBeaconData?: Record<string, unknown>;
  /** Milestones to track (default: [25, 50, 75, 100]) */
  milestones?: number[];
  /** Autoplay muted on load (shows video preview) */
  autoplay?: boolean;
  /** Optional CSS class on the outer wrapper */
  className?: string;
};

// ─── Helpers ────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────

export default function VideoPlayer({
  src,
  poster,
  onVideoEvent,
  onWatchTime,
  abandonBeaconUrl,
  abandonBeaconData,
  milestones = [25, 50, 75, 100],
  autoplay = false,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchTimeRef = useRef(0); // accumulated seconds watched
  const lastTickRef = useRef(0); // last timestamp for watch-time calc
  const firedMilestonesRef = useRef<Set<number>>(new Set());
  const hasStartedRef = useRef(false);
  const lastReportRef = useRef(0); // last watch-time report timestamp

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(autoplay);
  const [showBigPlay, setShowBigPlay] = useState(!autoplay);
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(autoplay);

  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── Emit event helper ──────────────────────────────

  const emit = useCallback(
    (event: VideoEvent, extra?: { milestone?: number }) => {
      if (!onVideoEvent || !videoRef.current) return;
      const v = videoRef.current;
      const pct = v.duration > 0 ? (v.currentTime / v.duration) * 100 : 0;
      onVideoEvent({
        event,
        currentTime: Math.round(v.currentTime),
        duration: Math.round(v.duration),
        percentWatched: Math.round(pct),
        totalWatchTime: Math.round(watchTimeRef.current),
        ...extra,
      });
    },
    [onVideoEvent]
  );

  // ─── Abandon tracking on unmount / page leave ───────

  const buildAbandonPayload = useCallback((): VideoEventPayload | null => {
    const v = videoRef.current;
    if (!hasStartedRef.current || !v || v.ended) return null;
    const pct = v.duration > 0 ? (v.currentTime / v.duration) * 100 : 0;
    return {
      event: "abandoned",
      currentTime: Math.round(v.currentTime),
      duration: Math.round(v.duration),
      percentWatched: Math.round(pct),
      totalWatchTime: Math.round(watchTimeRef.current),
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const payload = buildAbandonPayload();
      if (!payload) return;

      // Use sendBeacon for reliability (fetch may not complete on page leave)
      if (abandonBeaconUrl && navigator.sendBeacon) {
        navigator.sendBeacon(
          abandonBeaconUrl,
          JSON.stringify({ ...abandonBeaconData, ...payload })
        );
      }
      // Also try the callback (may not complete)
      onVideoEvent?.(payload);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Component unmount (SPA navigation) — callback works fine here
      const payload = buildAbandonPayload();
      if (payload) onVideoEvent?.(payload);
    };
  }, [buildAbandonPayload, onVideoEvent, abandonBeaconUrl, abandonBeaconData]);

  // ─── HLS attach (for .m3u8 streams) ─────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;

    const isHls = /\.m3u8($|\?)/i.test(src);
    if (!isHls) {
      v.src = src;
      return;
    }

    // Safari has native HLS support
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        startLevel: -1,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 30,
        abrEwmaDefaultEstimate: 1_000_000,
      });
      hls.loadSource(src);
      hls.attachMedia(v);
      return () => {
        hls.destroy();
      };
    }

    // Fallback
    v.src = src;
  }, [src]);

  // ─── Autoplay muted ─────────────────────────────────

  useEffect(() => {
    if (!autoplay || !videoRef.current) return;
    const v = videoRef.current;
    v.muted = true;
    v.play().catch(() => {});
  }, [autoplay]);

  // ─── Controls auto-hide ─────────────────────────────

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      scheduleHide();
    }
  }, [playing, scheduleHide]);

  // ─── Video event handlers ───────────────────────────

  const handlePlay = () => {
    setPlaying(true);
    setShowBigPlay(false);
    lastTickRef.current = Date.now();

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      emit("started");
    } else {
      emit("resumed");
    }
  };

  const handlePause = () => {
    setPlaying(false);
    // accumulate watch time
    watchTimeRef.current += (Date.now() - lastTickRef.current) / 1000;
    emit("paused");
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);

    // accumulate watch time while playing
    if (playing) {
      const now = Date.now();
      watchTimeRef.current += (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
    }

    // periodic watch-time report (throttled to 500ms)
    if (onWatchTime) {
      const now = Date.now();
      if (now - lastReportRef.current > 500) {
        lastReportRef.current = now;
        onWatchTime(watchTimeRef.current);
      }
    }

    // milestone check
    if (v.duration > 0) {
      const pct = (v.currentTime / v.duration) * 100;
      for (const m of milestones) {
        if (pct >= m && !firedMilestonesRef.current.has(m)) {
          firedMilestonesRef.current.add(m);
          emit("milestone", { milestone: m });
        }
      }
    }

  };

  const handleEnded = () => {
    setPlaying(false);
    watchTimeRef.current += (Date.now() - lastTickRef.current) / 1000;
    emit("completed");
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  // ─── User interactions ──────────────────────────────

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      v.play();
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleUnmuteAndRestart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    try {
      v.currentTime = 0;
    } catch {}
    watchTimeRef.current = 0;
    firedMilestonesRef.current = new Set();
    hasStartedRef.current = false;
    v.play().catch(() => {});
    setShowUnmuteOverlay(false);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    if (val === 0) {
      v.muted = true;
      setMuted(true);
    } else if (muted) {
      v.muted = false;
      setMuted(false);
    }
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div
      className={`vp-wrapper relative w-full aspect-video rounded-2xl overflow-hidden select-none ${className}`}
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 60px rgba(74, 222, 128, 0.03)",
        background: "#000",
      }}
      onMouseMove={scheduleHide}
      onClick={(e) => {
        // only toggle on the video area, not controls
        if ((e.target as HTMLElement).closest(".vp-controls")) return;
        if (showUnmuteOverlay) return;
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        preload="auto"
        playsInline
        className="absolute inset-0 w-full h-full object-contain"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Unmute + restart overlay (autoplay muted preview) */}
      {showUnmuteOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center z-30 cursor-pointer group/unmute"
          onClick={(e) => {
            e.stopPropagation();
            handleUnmuteAndRestart();
          }}
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(11,13,16,0.55) 0%, rgba(11,13,16,0.35) 60%, rgba(11,13,16,0.55) 100%)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        >
          {/* Outer pulse rings */}
          <span
            className="absolute rounded-full pointer-events-none unmute-pulse"
            style={{
              width: 180,
              height: 180,
              border: "1.5px solid rgba(74, 222, 128, 0.35)",
            }}
          />
          <span
            className="absolute rounded-full pointer-events-none unmute-pulse-2"
            style={{
              width: 180,
              height: 180,
              border: "1.5px solid rgba(74, 222, 128, 0.2)",
            }}
          />

          <div
            className="relative flex flex-col items-center justify-center gap-3 rounded-2xl px-7 py-5 md:px-9 md:py-6 transition-transform duration-300 group-hover/unmute:scale-[1.02]"
            style={{
              background:
                "linear-gradient(160deg, rgba(18,24,20,0.92) 0%, rgba(11,13,16,0.94) 100%)",
              border: "1px solid rgba(74, 222, 128, 0.35)",
              boxShadow:
                "0 24px 70px rgba(0,0,0,0.55), 0 0 60px rgba(74, 222, 128, 0.18), 0 0 0 1px rgba(255,255,255,0.04) inset",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {/* Top label */}
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "#4ADE80",
                  boxShadow: "0 0 8px rgba(74, 222, 128, 0.8)",
                }}
              />
              <span
                className="text-[10px] md:text-[11px] font-semibold uppercase"
                style={{
                  letterSpacing: "0.18em",
                  color: "#4ADE80",
                }}
              >
                Pulsa aquí
              </span>
            </div>

            {/* Icon disc */}
            <div
              className="unmute-disc relative flex items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                background:
                  "radial-gradient(circle at 30% 30%, rgba(74,222,128,0.18), rgba(74,222,128,0.04) 70%)",
                border: "1px solid rgba(74, 222, 128, 0.45)",
                boxShadow:
                  "0 6px 24px rgba(74, 222, 128, 0.25), 0 0 0 1px rgba(255,255,255,0.05) inset",
              }}
            >
              <svg
                className="unmute-icon"
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 10v4a1 1 0 001 1h3l4 4a1 1 0 001.7-.7V5.7A1 1 0 0011 5l-4 4H4a1 1 0 00-1 1z"
                  fill="#4ADE80"
                />
                <path
                  d="M16 9c1.2 1 2 2 2 3s-.8 2-2 3"
                  stroke="#4ADE80"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.55"
                />
                {/* mute slash */}
                <line
                  x1="4"
                  y1="20"
                  x2="20"
                  y2="4"
                  stroke="#0B0D10"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <line
                  className="unmute-slash"
                  x1="4"
                  y1="20"
                  x2="20"
                  y2="4"
                  stroke="#4ADE80"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Bottom label */}
            <span
              className="text-white text-[13px] md:text-[14px] font-medium text-center"
              style={{
                letterSpacing: "0.005em",
                fontFamily: "var(--font-satoshi)",
              }}
            >
              Toca para activar el sonido
            </span>
          </div>
        </div>
      )}

      {/* Big play button overlay */}
      {showBigPlay && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, rgba(18, 22, 28, 0.85) 0%, rgba(11, 13, 16, 0.92) 100%)",
          }}
        >
          <button
            className="play-pulse flex items-center justify-center w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-full cursor-pointer"
            style={{
              background: "rgba(74, 222, 128, 0.12)",
              border: "2px solid rgba(74, 222, 128, 0.4)",
            }}
          >
            <div
              className="w-0 h-0 border-t-[9px] border-t-transparent border-l-[16px] border-b-[9px] border-b-transparent ml-1"
              style={{ borderLeftColor: "#4ADE80" }}
            />
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className="vp-controls absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300"
        style={{
          opacity: showControls && !showBigPlay && !showUnmuteOverlay ? 1 : 0,
          pointerEvents: showControls && !showBigPlay && !showUnmuteOverlay ? "auto" : "none",
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "32px 12px 10px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white/90 hover:text-white cursor-pointer">
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button onClick={toggleMute} className="text-white/80 hover:text-white cursor-pointer">
              {muted || volume === 0 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : volume < 0.5 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <div className="relative w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-300">
              <div className="relative w-20 h-5 flex items-center">
                <div className="absolute left-0 w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                <div
                  className="absolute left-0 h-1 rounded-full"
                  style={{
                    width: `${(muted ? 0 : volume) * 100}%`,
                    background: "linear-gradient(90deg, #4ADE80, #86EFAC)",
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={changeVolume}
                  className="absolute w-full h-5 opacity-0 cursor-pointer"
                />
                <div
                  className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
                  style={{
                    left: `calc(${(muted ? 0 : volume) * 100}% - 5px)`,
                    background: "#86EFAC",
                    boxShadow: "0 0 4px rgba(74, 222, 128, 0.5)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
