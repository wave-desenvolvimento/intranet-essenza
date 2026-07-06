-- Grant table privileges to authenticated role
-- Without these, RLS-protected queries return empty instead of filtered results

-- Full CRUD tables (RLS controls row-level access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banner_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_item_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_page_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.franchise_stock TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.franchises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_prices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_queue TO authenticated;

-- Anon: only reseller_leads INSERT (public form)
GRANT INSERT ON public.reseller_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_leads TO authenticated;

-- Grant usage on sequences (needed for inserts with serial/identity columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
