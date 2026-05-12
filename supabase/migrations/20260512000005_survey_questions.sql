-- =============================================
-- SURVEY QUESTIONS (múltiplas perguntas por pesquisa)
-- =============================================

-- Types: nps (0-10), rating (1-5 stars), text (open), choice (single select)
CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'nps' CHECK (type IN ('nps', 'rating', 'text', 'choice')),
  options jsonb, -- for 'choice' type: ["Opção A", "Opção B", ...]
  required boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX idx_survey_questions_survey ON public.survey_questions(survey_id);

ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_select" ON public.survey_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_insert" ON public.survey_questions FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'pesquisas', 'create'));
CREATE POLICY "questions_update" ON public.survey_questions FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'pesquisas', 'edit'));
CREATE POLICY "questions_delete" ON public.survey_questions FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'pesquisas', 'delete'));

-- Answers: one per question per user
CREATE TABLE public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  value text NOT NULL, -- score as text, rating as text, free text, or choice value
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, response_id)
);

CREATE INDEX idx_survey_answers_response ON public.survey_answers(response_id);

ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers_select" ON public.survey_answers FOR SELECT TO authenticated
  USING (
    response_id IN (SELECT id FROM survey_responses WHERE user_id = auth.uid())
    OR public.has_permission(auth.uid(), 'pesquisas', 'view_all')
  );
CREATE POLICY "answers_insert" ON public.survey_answers FOR INSERT TO authenticated
  WITH CHECK (response_id IN (SELECT id FROM survey_responses WHERE user_id = auth.uid()));

-- Make score nullable on survey_responses (backward compat — old NPS-only responses keep their score)
ALTER TABLE public.survey_responses ALTER COLUMN score DROP NOT NULL;
ALTER TABLE public.survey_responses ALTER COLUMN score SET DEFAULT NULL;
