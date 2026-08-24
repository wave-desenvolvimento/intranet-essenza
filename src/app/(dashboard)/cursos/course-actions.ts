"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// Types
// ============================================================

export interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  slug: string;
  sort_order: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  video_count?: number;
}

export interface CourseVideo {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  source_type: "upload" | "youtube" | "external";
  video_url: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  sort_order: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

export interface LessonProgressRecord {
  video_id: string;
  watched_pct: number;
  completed_at: string | null;
}

// ============================================================
// Modules CRUD
// ============================================================

export async function getModules(): Promise<CourseModule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_modules")
    .select("*, course_videos(id)")
    .order("sort_order");

  return (data || []).map((m) => ({
    ...m,
    video_count: m.course_videos?.length || 0,
    course_videos: undefined,
  })) as CourseModule[];
}

export interface PublishedModule {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  slug: string;
  video_count: number;
  completed_count: number;
}

export async function getPublishedModulesWithProgress(): Promise<PublishedModule[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: modules } = await supabase
    .from("course_modules")
    .select("id, title, description, cover_url, slug, course_videos(id)")
    .eq("status", "published")
    .order("sort_order");

  if (!modules?.length) return [];

  // Fetch all lesson progress for this user across all modules
  let completedByModule: Record<string, number> = {};
  if (user) {
    const moduleIds = modules.map((m) => m.id);
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("module_id, video_id, completed_at")
      .eq("user_id", user.id)
      .in("module_id", moduleIds)
      .not("completed_at", "is", null);

    for (const p of progress || []) {
      if (p.module_id) {
        completedByModule[p.module_id] = (completedByModule[p.module_id] || 0) + 1;
      }
    }
  }

  return modules.map((m) => {
    const publishedVideos = m.course_videos?.length || 0;
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      cover_url: m.cover_url,
      slug: m.slug,
      video_count: publishedVideos,
      completed_count: completedByModule[m.id] || 0,
    };
  });
}

export async function getModule(id: string): Promise<CourseModule | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_modules")
    .select("*")
    .eq("id", id)
    .single();
  return data as CourseModule | null;
}

export async function createModule(formData: FormData): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Titulo obrigatorio" };

  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Get next sort_order
  const { data: last } = await supabase
    .from("course_modules")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from("course_modules")
    .insert({
      title: title.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      cover_url: (formData.get("cover_url") as string)?.trim() || null,
      slug,
      sort_order: (last?.sort_order ?? -1) + 1,
      status: (formData.get("status") as string) || "draft",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ja existe um modulo com esse nome" };
    return { error: error.message };
  }

  revalidatePath("/cursos");
  return { id: data.id };
}

export async function updateModule(id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Titulo obrigatorio" };

  const { error } = await supabase
    .from("course_modules")
    .update({
      title: title.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      cover_url: (formData.get("cover_url") as string)?.trim() || null,
      status: (formData.get("status") as string) || "draft",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/cursos");
  return {};
}

export async function deleteModule(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Delete storage files for uploaded videos in this module
  const { data: videos } = await supabase
    .from("course_videos")
    .select("storage_path")
    .eq("module_id", id)
    .not("storage_path", "is", null);

  if (videos?.length) {
    const paths = videos.map((v) => v.storage_path!).filter(Boolean);
    if (paths.length) {
      await supabase.storage.from("course-videos").remove(paths);
    }
  }

  const { error } = await supabase
    .from("course_modules")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/cursos");
  return {};
}

export async function reorderModules(orderedIds: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();

  const updates = orderedIds.map((id, i) =>
    supabase.from("course_modules").update({ sort_order: i }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/cursos");
  return {};
}

// ============================================================
// Videos CRUD
// ============================================================

export async function getVideos(moduleId: string): Promise<CourseVideo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_videos")
    .select("*")
    .eq("module_id", moduleId)
    .order("sort_order");

  return (data || []) as CourseVideo[];
}

export async function createVideo(moduleId: string, formData: FormData): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Titulo obrigatorio" };

  const sourceType = (formData.get("source_type") as string) || "youtube";
  const videoUrl = (formData.get("video_url") as string)?.trim() || null;
  const storagePath = (formData.get("storage_path") as string)?.trim() || null;

  if (sourceType === "youtube" && !videoUrl) return { error: "URL do YouTube obrigatoria" };
  if (sourceType === "upload" && !storagePath) return { error: "Faca upload do video" };
  if (sourceType === "external" && !videoUrl) return { error: "URL do video obrigatoria" };

  // Get next sort_order
  const { data: last } = await supabase
    .from("course_videos")
    .select("sort_order")
    .eq("module_id", moduleId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const durationStr = formData.get("duration_seconds") as string;
  const sizeStr = formData.get("size_bytes") as string;

  const { data, error } = await supabase
    .from("course_videos")
    .insert({
      module_id: moduleId,
      title: title.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      source_type: sourceType,
      video_url: videoUrl,
      storage_path: storagePath,
      thumbnail_url: (formData.get("thumbnail_url") as string)?.trim() || null,
      duration_seconds: durationStr ? parseInt(durationStr) : null,
      size_bytes: sizeStr ? parseInt(sizeStr) : null,
      sort_order: (last?.sort_order ?? -1) + 1,
      status: (formData.get("status") as string) || "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/cursos");
  return { id: data.id };
}

export async function updateVideo(id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Titulo obrigatorio" };

  const sourceType = (formData.get("source_type") as string) || "youtube";
  const videoUrl = (formData.get("video_url") as string)?.trim() || null;
  const storagePath = (formData.get("storage_path") as string)?.trim() || null;

  const durationStr = formData.get("duration_seconds") as string;
  const sizeStr = formData.get("size_bytes") as string;

  const { error } = await supabase
    .from("course_videos")
    .update({
      title: title.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      source_type: sourceType,
      video_url: videoUrl,
      storage_path: storagePath,
      thumbnail_url: (formData.get("thumbnail_url") as string)?.trim() || null,
      duration_seconds: durationStr ? parseInt(durationStr) : null,
      size_bytes: sizeStr ? parseInt(sizeStr) : null,
      status: (formData.get("status") as string) || "draft",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/cursos");
  return {};
}

export async function deleteVideo(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Delete storage file if uploaded
  const { data: video } = await supabase
    .from("course_videos")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (video?.storage_path) {
    await supabase.storage.from("course-videos").remove([video.storage_path]);
  }

  const { error } = await supabase
    .from("course_videos")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/cursos");
  return {};
}

export async function reorderVideos(moduleId: string, orderedIds: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();

  const updates = orderedIds.map((id, i) =>
    supabase.from("course_videos").update({ sort_order: i }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/cursos");
  return {};
}

// ============================================================
// Video URL (signed URL for uploads, direct for YouTube/external)
// ============================================================

export async function getVideoUrl(
  videoId: string,
  moduleId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  // Load all published videos in module ordered by sort_order
  const { data: videos } = await supabase
    .from("course_videos")
    .select("id, video_url, storage_path, source_type, sort_order")
    .eq("module_id", moduleId)
    .eq("status", "published")
    .order("sort_order");

  if (!videos?.length) return { error: "Modulo vazio" };

  const targetIndex = videos.findIndex((v) => v.id === videoId);
  if (targetIndex === -1) return { error: "Video nao encontrado" };

  // Sequential unlock: all previous videos must be completed
  if (targetIndex > 0) {
    const previousIds = videos.slice(0, targetIndex).map((v) => v.id);
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("video_id, completed_at")
      .eq("user_id", user.id)
      .eq("module_id", moduleId)
      .in("video_id", previousIds);

    const completedIds = new Set(
      (progress || [])
        .filter((p) => p.completed_at !== null)
        .map((p) => p.video_id)
    );

    for (const prevId of previousIds) {
      if (!completedIds.has(prevId)) {
        return { error: "Conclua as aulas anteriores primeiro" };
      }
    }
  }

  const video = videos[targetIndex];

  // Uploaded video: generate signed URL
  if (video.source_type === "upload" && video.storage_path) {
    const { data: signedData, error: signErr } = await supabase.storage
      .from("course-videos")
      .createSignedUrl(video.storage_path, 7200);

    if (signErr || !signedData?.signedUrl) {
      return { error: "Erro ao gerar URL do video" };
    }
    return { url: signedData.signedUrl };
  }

  // YouTube or external: return URL directly
  if (video.video_url) {
    return { url: video.video_url };
  }

  return { error: "URL nao definida" };
}

// ============================================================
// Lesson Progress
// ============================================================

export async function getLessonProgress(moduleId: string): Promise<LessonProgressRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("lesson_progress")
    .select("video_id, watched_pct, completed_at")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .not("video_id", "is", null);

  return (data || []) as LessonProgressRecord[];
}

export async function updateLessonProgress(
  videoId: string,
  moduleId: string,
  watchedPct: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  // Validate sequential unlock
  const { data: videos } = await supabase
    .from("course_videos")
    .select("id")
    .eq("module_id", moduleId)
    .eq("status", "published")
    .order("sort_order");

  if (videos?.length) {
    const targetIndex = videos.findIndex((v) => v.id === videoId);
    if (targetIndex > 0) {
      const previousIds = videos.slice(0, targetIndex).map((v) => v.id);
      const { data: progress } = await supabase
        .from("lesson_progress")
        .select("video_id, completed_at")
        .eq("user_id", user.id)
        .eq("module_id", moduleId)
        .in("video_id", previousIds);

      const completedIds = new Set(
        (progress || [])
          .filter((p) => p.completed_at !== null)
          .map((p) => p.video_id)
      );

      for (const prevId of previousIds) {
        if (!completedIds.has(prevId)) {
          return { error: "Conclua as aulas anteriores primeiro" };
        }
      }
    }
  }

  const pct = Math.min(100, Math.max(0, Math.round(watchedPct)));
  const completedAt = pct >= 95 ? new Date().toISOString() : null;

  const { error } = await supabase.rpc("upsert_lesson_progress", {
    p_user_id: user.id,
    p_video_id: videoId,
    p_module_id: moduleId,
    p_watched_pct: pct,
    p_completed_at: completedAt,
  });

  if (error) {
    // Fallback manual
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("id, watched_pct")
      .eq("user_id", user.id)
      .eq("video_id", videoId)
      .single();

    if (existing) {
      if (pct <= existing.watched_pct) return {};
      await supabase
        .from("lesson_progress")
        .update({ watched_pct: pct, completed_at: completedAt })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("lesson_progress")
        .insert({
          user_id: user.id,
          video_id: videoId,
          module_id: moduleId,
          watched_pct: pct,
          completed_at: completedAt,
        });
    }
  }

  return {};
}
