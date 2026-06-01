-- Fix: "new row for relation \"project_ai_settings\" violates check constraint
-- \"project_ai_settings_provider_check\"" when selecting a BloxSmith AI (Comet)
-- model.
--
-- Root cause: the provider check constraints predate the CometAPI gateway and
-- only allow up to 'neokens'. The app now saves provider = 'comet' when a user
-- picks a BloxSmith AI model, so the save is rejected. (The CometAPI migration
-- widened these, but it has not been applied to the live database.) This
-- re-asserts both constraints with the full provider set. Idempotent.

ALTER TABLE public.project_ai_settings
  DROP CONSTRAINT IF EXISTS project_ai_settings_provider_check;
ALTER TABLE public.project_ai_settings
  ADD CONSTRAINT project_ai_settings_provider_check
  CHECK (provider IS NULL OR provider IN ('openai','anthropic','google','groq','neokens','comet'));

ALTER TABLE public.user_provider_keys
  DROP CONSTRAINT IF EXISTS user_provider_keys_provider_check;
ALTER TABLE public.user_provider_keys
  ADD CONSTRAINT user_provider_keys_provider_check
  CHECK (provider IN ('openai','anthropic','google','groq','neokens','comet'));
