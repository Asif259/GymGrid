"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const REDUCE = "(prefers-reduced-motion: reduce)";

const subscribeMotion = (cb: () => void) => {
  const m = matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

interface Chapter {
  label: string;
  at: number;
  stamp: string;
}

const CHAPTERS: Chapter[] = [
  { label: "Door QR", at: 0, stamp: "0:00" },
  { label: "Desk sync", at: 8, stamp: "0:08" },
  { label: "Expired flag", at: 12, stamp: "0:12" },
  { label: "bKash TrxID", at: 16, stamp: "0:16" },
  { label: "Receipt & WhatsApp", at: 21, stamp: "0:21" },
];

const DEFAULT_DURATION = 30;

function fmtSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `0:${String(s).padStart(2, "0")}`;
}

export function WalkthroughFilm() {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);

  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia(REDUCE).matches,
    () => false,
  );

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(DEFAULT_DURATION);

  useEffect(() => {
    const host = frameRef.current;
    const video = videoRef.current;
    if (!host || !video || reduced) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          if (!userPausedRef.current) {
            video.play().catch(() => {});
          }
        } else {
          video.pause();
        }
      },
      { threshold: 0.45 },
    );

    io.observe(host);
    return () => io.disconnect();
  }, [reduced]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  const seekTo = (nextTime: number, autoplay = true) => {
    const video = videoRef.current;
    if (!video) return;
    const bounded = Math.min(Math.max(0, nextTime), duration);
    video.currentTime = bounded;
    setTime(bounded);
    if (autoplay) {
      userPausedRef.current = false;
      video.play().catch(() => {});
    }
  };

  const activeChapter = CHAPTERS.reduce(
    (idx, ch, i) => (time >= ch.at ? i : idx),
    0,
  );

  return (
    <div ref={frameRef} className="lp-film-frame" data-reveal>
      <div className="lp-film-stage">
        <video
          ref={videoRef}
          className="lp-film-video"
          src="/our-gym-qr-checkin.mp4"
          poster="/images/qr-checkin-poster.jpg"
          muted
          playsInline
          loop
          preload="metadata"
          aria-label="Thirty-second animated walkthrough showing QR door check-in, live desk status, expired plan alert, bKash TrxID payment, PDF receipt, and two-day WhatsApp reminder"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
              setDuration(e.currentTarget.duration);
            }
          }}
        />
      </div>

      <div className="lp-film-bar">
        <div className="lp-film-controls">
          <button
            type="button"
            className="lp-film-play"
            onClick={togglePlay}
            aria-label={playing ? "Pause walkthrough video" : "Play walkthrough video"}
          >
            {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>

          <button
            type="button"
            className="lp-film-restart"
            onClick={() => seekTo(0, true)}
            aria-label="Restart walkthrough video from 0:00"
          >
            <RotateCcw size={15} aria-hidden />
          </button>

          <span className="lp-film-time lp-mono">
            {fmtSec(time)} / {fmtSec(duration)}
          </span>

          <input
            type="range"
            className="lp-film-scrubber"
            min={0}
            max={duration}
            step={0.1}
            value={Math.min(time, duration)}
            aria-label="Seek walkthrough timeline"
            onChange={(e) => seekTo(Number(e.currentTarget.value), playing)}
          />
        </div>

        <div className="lp-film-chapters" role="group" aria-label="Walkthrough scenes">
          {CHAPTERS.map((ch, i) => {
            const on = i === activeChapter;
            return (
              <button
                key={ch.label}
                type="button"
                className="lp-film-chapter"
                aria-pressed={on}
                onClick={() => seekTo(ch.at, true)}
              >
                <span className="lp-mono">{ch.stamp}</span>
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
