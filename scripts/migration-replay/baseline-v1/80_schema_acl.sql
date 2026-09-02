REVOKE ALL PRIVILEGES ON SCHEMA noven_private FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA noven_private TO authenticated;

GRANT USAGE ON SCHEMA public TO PUBLIC;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
