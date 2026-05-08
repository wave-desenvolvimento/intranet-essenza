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

  const pct = Math.min(100, Math.max(0, Math.round(watchedPct)));
  const completedAt = pct >= 95 ? new Date().toISOString() : null;

  // Upsert — nunca reduz o progresso
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
      // Nunca reduz
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
