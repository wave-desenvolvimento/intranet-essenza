-- Add 'multiple_choice' to survey_questions type constraint
ALTER TABLE public.survey_questions DROP CONSTRAINT IF EXISTS survey_questions_type_check;
ALTER TABLE public.survey_questions ADD CONSTRAINT survey_questions_type_check
  CHECK (type IN ('nps', 'rating', 'text', 'choice', 'multiple_choice'));
