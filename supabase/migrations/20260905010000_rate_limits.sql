-- Shared rate-limit counters.
--
-- The app runs as serverless functions, so an in-process counter only limits a
-- single warm instance and an attacker just spreads requests across cold
-- starts. Keeping the window in Postgres makes the limit global.
--
-- Callers reach this through the service role only. RLS is enabled with no
-- policies so no anon or authenticated client can read or forge counters.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC;
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO service_role;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

/**
 * Count one hit against a fixed window and report whether it is allowed.
 *
 * The whole read-modify-write happens in a single INSERT .. ON CONFLICT so
 * concurrent requests cannot both observe the same pre-increment count.
 */
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_increment INTEGER DEFAULT 1
)
RETURNS TABLE (allowed BOOLEAN, hits INTEGER, retry_after INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window INTERVAL := make_interval(secs => GREATEST(1, p_window_seconds));
  v_start TIMESTAMPTZ;
  v_hits INTEGER;
  v_step INTEGER := GREATEST(1, COALESCE(p_increment, 1));
BEGIN
  INSERT INTO public.rate_limits AS rl (key, window_start, hits)
  VALUES (p_key, v_now, v_step)
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE WHEN rl.window_start < v_now - v_window THEN v_step ELSE rl.hits + v_step END,
        window_start = CASE WHEN rl.window_start < v_now - v_window THEN v_now ELSE rl.window_start END
  RETURNING rl.window_start, rl.hits INTO v_start, v_hits;

  -- Opportunistic cleanup so the table cannot grow without bound.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < v_now - INTERVAL '1 day';
  END IF;

  RETURN QUERY
  SELECT
    v_hits <= GREATEST(1, p_limit),
    v_hits,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_start + v_window - v_now))))::INTEGER;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER, INTEGER) OWNER TO postgres;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

DROP FUNCTION IF EXISTS public.rate_limit_hit(TEXT, INTEGER, INTEGER);

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER, INTEGER) FROM anon, authenticated;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
