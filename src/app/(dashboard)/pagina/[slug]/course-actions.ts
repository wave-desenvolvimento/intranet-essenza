"use server";

import { createClient } from "@/lib/supabase/server";

export interface LessonProgressRecord {
  item_id: string;
  watched_pct: number;
  completed_at: string | null;
}

export async function getLessonProgress(
  collectionId: string
): Promise<LessonProgressRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("lesson_progress")
    .select("item_id, watched_pct, completed_at")
    .eq("user_id", user.id)
    .eq("collection_id", collectionId);

  return (data || []) as LessonProgressRecord[];
}

// Returns the video URL only if the lesson is unlocked (previous lessons completed)
export async function getVideoUrl(
  itemId: string,
  collectionId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  // Load all items in this collection ordered by sort_order
  const { data: items } = await supabase
    .from("cms_items")
    .select("id, data, sort_order")
    .eq("collection_id", collectionId)
    .eq("status", "published")
    .order("sort_order");

  if (!items || items.length === 0) return { error: "Colecao vazia" };

  // Find the requested item index
  const targetIndex = items.findIndex((it) => it.id === itemId);
  if (targetIndex === -1) return { error: "Aula nao encontrada" };

  // Check sequential unlock: all previous lessons must be completed
  if (targetIndex > 0) {
    const previousIds = items.slice(0, targetIndex).map((it) => it.id);
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("item_id, completed_at")
      .eq("user_id", user.id)
      .eq("collection_id", collectionId)
      .in("item_id", previousIds);

    const completedIds = new Set(
      (progress || [])
        .filter((p) => p.completed_at !== null)
        .map((p) => p.item_id)
    );

    for (const prevId of previousIds) {
      if (!completedIds.has(prevId)) {
        return { error: "Conclua as aulas anteriores primeiro" };
      }
    }
  }

  // Find the URL field and return its value
  const { data: fields } = await supabase
    .from("cms_fields")
    .select("slug")
    .eq("collection_id", collectionId)
    .eq("field_type", "url")
    .limit(1)
    .single();

  if (!fields) return { error: "Campo de URL nao encontrado" };

  const item = items[targetIndex];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (item.data as any)?.[fields.slug];
  if (!url) return { error: "URL nao definida" };

  return { url: String(url) };
}

export async function updateLessonProgress(
  itemId: string,
  collectionId: string,
  watchedPct: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  // Validate sequential: can only update progress if previous lessons are completed
  const { data: items } = await supabase
    .from("cms_items")
    .select("id")
    .eq("collection_id", collectionId)
    .eq("status", "published")
    .order("sort_order");

  if (items && items.length > 0) {
    const targetIndex = items.findIndex((it) => it.id === itemId);
    if (targetIndex > 0) {
      const previousIds = items.slice(0, targetIndex).map((it) => it.id);
      const { data: progress } = await supabase
        .from("lesson_progress")
        .select("item_id, completed_at")
        .eq("user_id", user.id)
        .eq("collection_id", collectionId)
        .in("item_id", previousIds);

      const completedIds = new Set(
        (progress || [])
          .filter((p) => p.completed_at !== null)
          .map((p) => p.item_id)
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

  // Upsert - nunca reduz o progresso
  const { error } = await supabase.rpc("upsert_lesson_progress", {
    p_user_id: user.id,
    p_item_id: itemId,
    p_collection_id: collectionId,
    p_watched_pct: pct,
    p_completed_at: completedAt,
  });

  if (error) {
    // Fallback: insert/update manual
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("id, watched_pct")
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .single();

    if (existing) {
      if (pct <= existing.watched_pct) return {};
      const { error: updateErr } = await supabase
        .from("lesson_progress")
        .update({
          watched_pct: pct,
          completed_at: completedAt,
        })
        .eq("id", existing.id);
      if (updateErr) return { error: updateErr.message };
    } else {
      const { error: insertErr } = await supabase
        .from("lesson_progress")
        .insert({
          user_id: user.id,
          item_id: itemId,
          collection_id: collectionId,
          watched_pct: pct,
          completed_at: completedAt,
        });
      if (insertErr) return { error: insertErr.message };
    }
  }

  return {};
}
