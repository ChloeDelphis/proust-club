-- Move existing objects in place. PostgreSQL keeps table data, indexes, owned
-- sequences, constraints and foreign-key dependencies when a table changes schema.
CREATE SCHEMA IF NOT EXISTS corpus;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS library;
CREATE SCHEMA IF NOT EXISTS admin;

ALTER TABLE public.volumes SET SCHEMA corpus;
ALTER TABLE public.parts SET SCHEMA corpus;
ALTER TABLE public.paragraphs SET SCHEMA corpus;

ALTER TABLE public.users SET SCHEMA identity;
ALTER TABLE public.password_reset_tokens SET SCHEMA identity;
ALTER TABLE public.email_verification_tokens SET SCHEMA identity;

ALTER TABLE public.quote_selections SET SCHEMA library;
ALTER TABLE public.tags SET SCHEMA library;
ALTER TABLE public.quote_selection_tags SET SCHEMA library;

ALTER TABLE public.admin_mfa_credentials SET SCHEMA admin;
ALTER TABLE public.admin_mfa_recovery_codes SET SCHEMA admin;
ALTER TABLE public.admin_daily_metrics SET SCHEMA admin;
ALTER TABLE public.admin_notification_settings SET SCHEMA admin;
ALTER TABLE public.admin_notification_outbox SET SCHEMA admin;
