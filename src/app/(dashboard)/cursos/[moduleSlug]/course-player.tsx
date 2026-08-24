"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Lock, Check, Clock, ArrowLeft, FileDown, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import Link from "next/link";
import {
  getVideoUrl,
  getLessonProgress,
  updateLessonProgress,
} from "../course-actions";

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  source_type: "upload" | "youtube" | "external";
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
}

interface ModuleData {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  slug: string;
}

export function CoursePlayerView({
  module,
  videos,
}: {
  module: ModuleData;
  videos: VideoItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [currentPct, setCurrentPct] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [activeUrl, setActiveUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxPctRef = useRef(0);
  const ytPlayingRef = useRef(false);

  const activeVideo = videos[activeIndex];

  function parseVideoSource(url: string): { type: "youtube" | "bunny" | "native"; embedUrl: string } {
    if (!url) return { type: "native", embedUrl: "" };

    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&disablekb=1&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`,
      };
    }

    const bunnyMatch = url.match(/mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/i);
    if (bunnyMatch) {
      return {
        type: "bunny",
        embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyMatch[1]}/${bunnyMatch[2]}?autoplay=false&preload=true&responsive=true&controls=false`,
      };
    }

    const guidMatch = url.match(/^([a-f0-9-]{36})$/i);
    if (guidMatch) {
      return {
        type: "bunny",
        embedUrl: `https://iframe.mediadelivery.net/embed//${guidMatch[1]}?autoplay=false&preload=true&responsive=true&controls=false`,
      };
    }

    return { type: "native", embedUrl: url };
  }

  const videoSource = parseVideoSource(activeUrl);
  const isIframe = videoSource.type === "youtube" || videoSource.type === "bunny";

  // Load saved progress on mount
  useEffect(() => {
    async function load() {
      const records = await getLessonProgress(module.id);
      const map: Record<string, number> = {};
      const completed = new Set<string>();
      for (const r of records) {
        map[r.video_id] = r.watched_pct;
        if (r.completed_at) completed.add(r.video_id);
      }
      setProgressMap(map);
      setCompletedSet(completed);
      setLoadingProgress(false);
    }
    load();
  }, [module.id]);

  // Fetch video URL when lesson changes
  useEffect(() => {
    if (!activeVideo || loadingProgress) return;
    setActiveUrl("");
    setLoadingUrl(true);
    let cancelled = false;
    async function fetchUrl() {
      const res = await getVideoUrl(activeVideo.id, module.id);
      if (cancelled) return;
      if ("url" in res) setActiveUrl(res.url);
      else {
        setActiveUrl("");
        if (res.error && res.error !== "URL nao definida") toast.error(res.error);
      }
      setLoadingUrl(false);
    }
    fetchUrl();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeVideo?.id, loadingProgress, module.id]);

  // Reset maxPct when changing lesson
  useEffect(() => {
    maxPctRef.current = progressMap[activeVideo?.id] || 0;
    setCurrentPct(maxPctRef.current);
  }, [activeIndex, activeVideo?.id, progressMap]);

  // Listen to postMessage events for progress
  useEffect(() => {
    if (!isIframe || !activeVideo) return;

    function handleMessage(e: MessageEvent) {
      if (!e.data) return;

      // Bunny
      if (typeof e.data === "object" && e.data.event === "timeupdate" && e.data.data) {
        const { currentTime: ct, duration: dur } = e.data.data;
        if (dur > 0) {
          const pct = Math.round((ct / dur) * 100);
          if (pct > maxPctRef.current) maxPctRef.current = pct;
          setCurrentPct(maxPctRef.current);
          debouncedSave(activeVideo.id);
        }
      }
      if (typeof e.data === "object" && e.data.event === "ended") {
        completeLesson(activeVideo.id);
      }

      // YouTube
      if (typeof e.data === "string") {
        try {
          const yt = JSON.parse(e.data);
          if (yt.event === "onStateChange") {
            if (yt.info === 0) completeLesson(activeVideo.id);
            if (yt.info === 1) ytPlayingRef.current = true;
            if (yt.info === 2) ytPlayingRef.current = false;
          }
          if (yt.event === "infoDelivery" && yt.info?.currentTime != null && yt.info?.duration) {
            const pct = Math.round((yt.info.currentTime / yt.info.duration) * 100);
            if (pct > maxPctRef.current) maxPctRef.current = pct;
            setCurrentPct(maxPctRef.current);
            debouncedSave(activeVideo.id);
          }
        } catch { /* not a YT message */ }
      }
    }

    if (videoSource.type === "youtube") {
      const timer = setTimeout(() => {
        const iframe = document.querySelector<HTMLIFrameElement>("[data-course-iframe]");
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
        }
      }, 1000);
      window.addEventListener("message", handleMessage);
      return () => { clearTimeout(timer); window.removeEventListener("message", handleMessage); flushSave(activeVideo.id); };
    }

    window.addEventListener("message", handleMessage);
    return () => { window.removeEventListener("message", handleMessage); flushSave(activeVideo.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isIframe, activeVideo?.id, videoSource.type]);

  function debouncedSave(videoId: string) {
    if (!saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveProgress(videoId, maxPctRef.current);
        saveTimerRef.current = null;
      }, 5000);
    }
  }

  function flushSave(videoId: string) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxPctRef.current > 0) saveProgress(videoId, maxPctRef.current);
  }

  function completeLesson(videoId: string) {
    maxPctRef.current = 100;
    setCurrentPct(100);
    saveProgress(videoId, 100);
    markCompleted(videoId);
  }

  function handleNativeTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    if (video.duration > 0) {
      const pct = Math.round((video.currentTime / video.duration) * 100);
      if (pct > maxPctRef.current) maxPctRef.current = pct;
      setCurrentPct(maxPctRef.current);
      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          if (activeVideo) saveProgress(activeVideo.id, maxPctRef.current);
          saveTimerRef.current = null;
        }, 5000);
      }
    }
  }

  function handleNativeEnded() {
    if (!activeVideo) return;
    completeLesson(activeVideo.id);
  }

  async function saveProgress(videoId: string, pct: number) {
    setProgressMap((prev) => ({ ...prev, [videoId]: Math.max(prev[videoId] || 0, pct) }));
    await updateLessonProgress(videoId, module.id, pct);
  }

  function markCompleted(videoId: string) {
    setCompletedSet((prev) => new Set([...prev, videoId]));
    if (activeIndex < videos.length - 1) {
      setTimeout(() => setActiveIndex(activeIndex + 1), 1500);
    }
  }

  function isLessonUnlocked(index: number): boolean {
    if (index === 0) return true;
    return completedSet.has(videos[index - 1].id);
  }

  function handleLessonClick(index: number) {
    if (!isLessonUnlocked(index)) {
      toast.error("Conclua a aula anterior para desbloquear esta.");
      return;
    }
    setActiveIndex(index);
  }

  const completedCount = videos.filter((v) => completedSet.has(v.id)).length;

  if (videos.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/cursos" className="rounded-lg p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-ink-900">{module.title}</h1>
        </div>
        <p className="text-center text-sm text-ink-400 py-8">Nenhuma aula disponivel</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cursos" className="rounded-lg p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-ink-900 truncate">{module.title}</h1>
          <p className="text-xs text-ink-500">{completedCount}/{videos.length} aulas concluidas</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
        {/* Main video area */}
        <div className="w-full lg:flex-1 lg:min-w-0 rounded-xl border border-ink-100 bg-white overflow-hidden">
          <div className="relative aspect-video bg-black overflow-hidden">
            {loadingUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span className="text-xs text-white/60">Carregando aula...</span>
              </div>
            ) : activeUrl ? (
              isIframe ? (
                <iframe
                  data-course-iframe
                  key={activeUrl}
                  src={videoSource.embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ border: 0 }}
                />
              ) : (
                <video
                  key={activeUrl}
                  src={videoSource.embedUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  onTimeUpdate={handleNativeTimeUpdate}
                  onEnded={handleNativeEnded}
                  onContextMenu={(e) => e.preventDefault()}
                  controlsList="nodownload noplaybackrate nofullscreen"
                  playsInline
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Lock size={24} className="text-white/30" />
                  <span className="text-white/50 text-sm">Nenhum video disponivel</span>
                </div>
              </div>
            )}
          </div>

          {/* Lesson info */}
          <div className="p-4 space-y-2.5">
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Aula {activeIndex + 1} - {activeVideo.title}
              </p>
              {activeVideo.duration_seconds != null && activeVideo.duration_seconds > 0 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock size={12} className="text-ink-500" />
                  <span className="text-xs text-ink-500">{formatDuration(activeVideo.duration_seconds)}</span>
                </div>
              )}
            </div>
            {activeVideo.description && (
              <div
                className="text-sm text-ink-500 leading-relaxed prose prose-sm prose-ink max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeVideo.description) }}
              />
            )}
          </div>
        </div>

        {/* Lesson sidebar */}
        <div className="w-full lg:w-[360px] shrink-0 flex flex-col rounded-xl border border-ink-100 bg-white overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-ink-50">
            <p className="text-sm font-semibold text-ink-900">Aulas</p>
          </div>
          <div className="flex flex-col">
            {videos.map((vid, i) => {
              const isActive = i === activeIndex;
              const isCompleted = completedSet.has(vid.id);
              const unlocked = isLessonUnlocked(i);
              const savedPct = progressMap[vid.id] || 0;
              const lessonPct = isActive ? currentPct : isCompleted ? 100 : savedPct;

              return (
                <button
                  key={vid.id}
                  onClick={() => handleLessonClick(i)}
                  className={cn(
                    "flex items-center gap-4 px-[18px] py-3.5 text-left transition-colors border-b border-ink-50 last:border-0",
                    isActive ? "bg-ink-100" : unlocked ? "hover:bg-ink-50" : "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    isActive ? "bg-brand-olive" : "bg-white"
                  )}>
                    {isCompleted ? (
                      <Check size={12} className={isActive ? "text-white" : "text-brand-olive"} strokeWidth={3} />
                    ) : unlocked ? (
                      <Play size={12} className={cn("ml-0.5", isActive ? "text-white" : "text-ink-400")} />
                    ) : (
                      <Lock size={12} className="text-ink-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm truncate", isActive ? "font-semibold text-ink-900" : "text-ink-900")}>
                        {i + 1}. {vid.title}
                      </span>
                      {vid.duration_seconds != null && vid.duration_seconds > 0 && (
                        <span className="text-xs text-ink-500 shrink-0">{formatDuration(vid.duration_seconds)}</span>
                      )}
                    </div>
                    <div className="h-[3px] w-full rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-olive transition-all duration-300"
                        style={{ width: `${lessonPct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
