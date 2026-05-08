-- Fix: upsert_lesson_progress must enforce auth.uid() to prevent
-- users from setting progress for other users via direct RPC call

CREATE OR REPLACE FUNCTION public.upsert_lesson_progress(
  p_user_id uuid,
  p_item_id uuid,
  p_collection_id uuid,
  p_watched_pct smallint,
  p_completed_at timestamptz default null
) RETURNS void AS $$
DECLARE
  actual_user_id uuid;
BEGIN
  -- Force the actual authenticated user, ignore p_user_id
  actual_user_id := auth.uid();
  IF actual_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.lesson_progress (user_id, item_id, collection_id, watched_pct, completed_at)
  VALUES (actual_user_id, p_item_id, p_collection_id, p_watched_pct, p_completed_at)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET
    watched_pct = GREATEST(lesson_progress.watched_pct, EXCLUDED.watched_pct),
    completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
