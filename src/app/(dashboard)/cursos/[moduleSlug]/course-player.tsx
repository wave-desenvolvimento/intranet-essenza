"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Lock, Check, Clock, ArrowLeft, ChevronDown, ChevronUp, Square, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface SidebarModule {
  id: string;
  title: string;
  slug: string;
  videos: { id: string; title: string; duration_seconds: number | null }[];
}

interface ModuleData {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  slug: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  }
  return `${m}min`;
}

export function CoursePlayerView({
  module,
  videos,
  sidebarModules,
}: {
  module: ModuleData;
  videos: VideoItem[];
  sidebarModules: SidebarModule[];
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [currentPct, setCurrentPct] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [activeUrl, setActiveUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([module.id]));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxPctRef = useRef(0);
  const ytPlayingRef = useRef(false);

  const activeVideo = videos[activeIndex];

  function toggleSection(moduleId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

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
      return { type: "bunny", embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyMatch[1]}/${bunnyMatch[2]}?autoplay=false&preload=true&responsive=true&controls=false` };
    }
    const guidMatch = url.match(/^([a-f0-9-]{36})$/i);
    if (guidMatch) {
      return { type: "bunny", embedUrl: `https://iframe.mediadelivery.net/embed//${guidMatch[1]}?autoplay=false&preload=true&responsive=true&controls=false` };
    }
    return { type: "native", embedUrl: url };
  }

  const videoSource = parseVideoSource(activeUrl);
  const isIframe = videoSource.type === "youtube" || videoSource.type === "bunny";

  // Load progress
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

  // Fetch video URL
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

  useEffect(() => {
    maxPctRef.current = progressMap[activeVideo?.id] || 0;
    setCurrentPct(maxPctRef.current);
  }, [activeIndex, activeVideo?.id, progressMap]);

  // PostMessage listener
  useEffect(() => {
    if (!isIframe || !activeVideo) return;
    function handleMessage(e: MessageEvent) {
      if (!e.data) return;
      if (typeof e.data === "object" && e.data.event === "timeupdate" && e.data.data) {
        const { currentTime: ct, duration: dur } = e.data.data;
        if (dur > 0) {
          const pct = Math.round((ct / dur) * 100);
          if (pct > maxPctRef.current) maxPctRef.current = pct;
          setCurrentPct(maxPctRef.current);
          debouncedSave(activeVideo.id);
        }
      }
      if (typeof e.data === "object" && e.data.event === "ended") completeLesson(activeVideo.id);
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
        } catch { /* ignore */ }
      }
    }
    if (videoSource.type === "youtube") {
      const timer = setTimeout(() => {
        const iframe = document.querySelector<HTMLIFrameElement>("[data-course-iframe]");
        if (iframe?.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
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
      saveTimerRef.current = setTimeout(() => { saveProgress(videoId, maxPctRef.current); saveTimerRef.current = null; }, 5000);
    }
  }
  function flushSave(videoId: string) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (maxPctRef.current > 0) saveProgress(videoId, maxPctRef.current);
  }
  function completeLesson(videoId: string) {
    maxPctRef.current = 100;
    setCurrentPct(100);
    saveProgress(videoId, 100);
    markCompleted(videoId);
  }
  function handleNativeTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const vid = e.currentTarget;
    if (vid.duration > 0) {
      const pct = Math.round((vid.currentTime / vid.duration) * 100);
      if (pct > maxPctRef.current) maxPctRef.current = pct;
      setCurrentPct(maxPctRef.current);
      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => { if (activeVideo) saveProgress(activeVideo.id, maxPctRef.current); saveTimerRef.current = null; }, 5000);
      }
    }
  }
  function handleNativeEnded() { if (activeVideo) completeLesson(activeVideo.id); }
  async function saveProgress(videoId: string, pct: number) {
    setProgressMap((prev) => ({ ...prev, [videoId]: Math.max(prev[videoId] || 0, pct) }));
    await updateLessonProgress(videoId, module.id, pct);
  }
  function markCompleted(videoId: string) {
    setCompletedSet((prev) => new Set([...prev, videoId]));
    if (activeIndex < videos.length - 1) setTimeout(() => setActiveIndex(activeIndex + 1), 1500);
  }
  function isLessonUnlocked(index: number): boolean {
    if (index === 0) return true;
    return completedSet.has(videos[index - 1].id);
  }
  function handleLessonClick(index: number) {
    if (!isLessonUnlocked(index)) { toast.error("Conclua a aula anterior para desbloquear esta."); return; }
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
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-ink-100 bg-white shrink-0">
        <Link href="/cursos" className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-900 truncate">{module.title}</p>
          <p className="text-xs text-ink-500">{completedCount}/{videos.length} aulas concluidas</p>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors"
        >
          Conteudo do curso
          {sidebarOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Main - Video + info */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Video */}
          <div className="relative aspect-video bg-black shrink-0">
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
                  <span className="text-white/50 text-sm">Video bloqueado</span>
                </div>
              </div>
            )}
          </div>

          {/* Lesson info below video */}
          <div className="p-5 space-y-3">
            <div>
              <p className="text-base font-semibold text-ink-900">
                Aula {activeIndex + 1} - {activeVideo.title}
              </p>
              {activeVideo.duration_seconds != null && activeVideo.duration_seconds > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
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

          {/* Mobile: lesson list */}
          <div className="lg:hidden border-t border-ink-100">
            <SidebarContent
              sidebarModules={sidebarModules}
              currentModuleId={module.id}
              videos={videos}
              activeIndex={activeIndex}
              completedSet={completedSet}
              progressMap={progressMap}
              currentPct={currentPct}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onLessonClick={handleLessonClick}
              isLessonUnlocked={isLessonUnlocked}
              onNavigateModule={(slug) => router.push(`/cursos/${slug}`)}
            />
          </div>
        </div>

        {/* Desktop sidebar */}
        {sidebarOpen && (
          <div className="hidden lg:flex flex-col w-[380px] shrink-0 border-l border-ink-100 bg-white overflow-y-auto">
            <div className="px-4 py-3 border-b border-ink-50 shrink-0">
              <p className="text-sm font-semibold text-ink-900">Conteudo do curso</p>
            </div>
            <SidebarContent
              sidebarModules={sidebarModules}
              currentModuleId={module.id}
              videos={videos}
              activeIndex={activeIndex}
              completedSet={completedSet}
              progressMap={progressMap}
              currentPct={currentPct}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onLessonClick={handleLessonClick}
              isLessonUnlocked={isLessonUnlocked}
              onNavigateModule={(slug) => router.push(`/cursos/${slug}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sidebar Content - sections with collapsible video lists
// ============================================================

function SidebarContent({
  sidebarModules,
  currentModuleId,
  videos,
  activeIndex,
  completedSet,
  progressMap,
  currentPct,
  expandedSections,
  onToggleSection,
  onLessonClick,
  isLessonUnlocked,
  onNavigateModule,
}: {
  sidebarModules: { id: string; title: string; slug: string; videos: { id: string; title: string; duration_seconds: number | null }[] }[];
  currentModuleId: string;
  videos: { id: string; title: string; duration_seconds: number | null }[];
  activeIndex: number;
  completedSet: Set<string>;
  progressMap: Record<string, number>;
  currentPct: number;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
  onLessonClick: (index: number) => void;
  isLessonUnlocked: (index: number) => boolean;
  onNavigateModule: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {sidebarModules.map((mod) => {
        const isCurrentModule = mod.id === currentModuleId;
        const isExpanded = expandedSections.has(mod.id);
        const modVideos = isCurrentModule ? videos : mod.videos;
        const completedInSection = modVideos.filter((v) => completedSet.has(v.id)).length;
        const totalDur = modVideos.reduce((s, v) => s + (v.duration_seconds || 0), 0);

        return (
          <div key={mod.id} className="border-b border-ink-50 last:border-0">
            {/* Section header */}
            <button
              onClick={() => onToggleSection(mod.id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-ink-50/50 transition-colors",
                isCurrentModule && "bg-ink-50/30"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold text-ink-900 truncate", isCurrentModule && "text-brand-olive")}>
                  {mod.title}
                </p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {completedInSection}/{modVideos.length} aulas
                  {totalDur > 0 && ` | ${formatDurationShort(totalDur)}`}
                </p>
              </div>
              {isExpanded ? <ChevronUp size={14} className="text-ink-400 shrink-0" /> : <ChevronDown size={14} className="text-ink-400 shrink-0" />}
            </button>

            {/* Video list */}
            {isExpanded && (
              <div className="pb-1">
                {modVideos.map((vid, i) => {
                  if (!isCurrentModule) {
                    // Other module: just show the list, click navigates
                    return (
                      <button
                        key={vid.id}
                        onClick={() => onNavigateModule(mod.slug)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-50 transition-colors"
                      >
                        <div className="shrink-0">
                          {completedSet.has(vid.id) ? (
                            <CheckSquare size={15} className="text-brand-olive" />
                          ) : (
                            <Square size={15} className="text-ink-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-ink-700 truncate">{i + 1}. {vid.title}</p>
                        </div>
                        {vid.duration_seconds != null && vid.duration_seconds > 0 && (
                          <span className="text-[11px] text-ink-400 shrink-0 flex items-center gap-0.5">
                            <Clock size={10} />
                            {formatDuration(vid.duration_seconds)}
                          </span>
                        )}
                      </button>
                    );
                  }

                  // Current module: interactive list
                  const isActive = i === activeIndex;
                  const isCompleted = completedSet.has(vid.id);
                  const unlocked = isLessonUnlocked(i);

                  return (
                    <button
                      key={vid.id}
                      onClick={() => handleVideoClick(i, unlocked, onLessonClick)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isActive ? "bg-ink-100" : unlocked ? "hover:bg-ink-50" : "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckSquare size={15} className="text-brand-olive" />
                        ) : unlocked ? (
                          isActive ? (
                            <Play size={13} className="text-brand-olive ml-0.5" />
                          ) : (
                            <Square size={15} className="text-ink-300" />
                          )
                        ) : (
                          <Lock size={13} className="text-ink-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs truncate",
                          isActive ? "font-semibold text-ink-900" : "text-ink-700"
                        )}>
                          {i + 1}. {vid.title}
                        </p>
                        {/* Mini progress */}
                        {isActive && currentPct > 0 && currentPct < 100 && (
                          <div className="h-[2px] w-full rounded-full bg-ink-100 mt-1.5 overflow-hidden">
                            <div className="h-full rounded-full bg-brand-olive transition-all" style={{ width: `${currentPct}%` }} />
                          </div>
                        )}
                      </div>
                      {vid.duration_seconds != null && vid.duration_seconds > 0 && (
                        <span className="text-[11px] text-ink-400 shrink-0 flex items-center gap-0.5">
                          <Clock size={10} />
                          {formatDuration(vid.duration_seconds)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function handleVideoClick(index: number, unlocked: boolean, onLessonClick: (i: number) => void) {
  if (!unlocked) {
    toast.error("Conclua a aula anterior para desbloquear esta.");
    return;
  }
  onLessonClick(index);
}
