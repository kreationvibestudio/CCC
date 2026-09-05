-- Aggregate the executive dashboard's KPIs in the database.
--
-- The dashboard used to SELECT the raw rows and reduce them in JavaScript.
-- PostgREST caps a response at db-max-rows (1000 by default), so with more than
-- 1000 donations or inbox comments the "Donations", "Sentiment Score",
-- "Pending Comments" and issue-breakdown figures silently reported a prefix of
-- the data as if it were the whole. The social counters were worse: they were
-- reduced over the last 10 posts only, so "FB Posts" could never exceed 10.
--
-- SECURITY INVOKER on purpose: every table read here is protected by
-- `tenant_id = current_tenant_id()`, so an authenticated caller can only
-- aggregate rows it could already select. p_tenant_id then narrows within that,
-- and service_role (which bypasses RLS) still needs it to pick a workspace.

CREATE OR REPLACE FUNCTION public.dashboard_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_donations numeric := 0;
  v_followers bigint := 0;
  v_posts bigint := 0;
  v_likes bigint := 0;
  v_shares bigint := 0;
  v_post_comments bigint := 0;
  v_comments bigint := 0;
  v_positive bigint := 0;
  v_neutral bigint := 0;
  v_negative bigint := 0;
  v_pending bigint := 0;
  v_misinformation bigint := 0;
  v_issues jsonb := '[]'::jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_donations
  FROM donations WHERE tenant_id = p_tenant_id;

  SELECT coalesce(sum(followers), 0) INTO v_followers
  FROM social_accounts WHERE tenant_id = p_tenant_id;

  SELECT
    count(*),
    coalesce(sum(likes), 0),
    coalesce(sum(shares), 0),
    coalesce(sum(comments_count), 0)
  INTO v_posts, v_likes, v_shares, v_post_comments
  FROM social_posts WHERE tenant_id = p_tenant_id;

  SELECT
    count(*),
    count(*) FILTER (WHERE sentiment = 'positive'),
    count(*) FILTER (WHERE sentiment = 'neutral'),
    count(*) FILTER (WHERE sentiment = 'negative'),
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE is_misinformation)
  INTO v_comments, v_positive, v_neutral, v_negative, v_pending, v_misinformation
  FROM comments WHERE tenant_id = p_tenant_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('topic', topic, 'count', n) ORDER BY n DESC), '[]'::jsonb)
  INTO v_issues
  FROM (
    SELECT coalesce(nullif(btrim(issue_topic::text), ''), 'other') AS topic, count(*) AS n
    FROM comments
    WHERE tenant_id = p_tenant_id
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 6
  ) s;

  RETURN jsonb_build_object(
    'donations', v_donations,
    'followers', v_followers,
    'posts', v_posts,
    'likes', v_likes,
    'shares', v_shares,
    'post_comments', v_post_comments,
    'comments', v_comments,
    'sentiment', jsonb_build_object(
      'positive', v_positive,
      'neutral', v_neutral,
      'negative', v_negative
    ),
    'pending_comments', v_pending,
    'misinformation', v_misinformation,
    'issues', v_issues
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(uuid) TO authenticated, service_role;

-- The analytics donation trend used to fetch every donation row and bucket it
-- by month in JavaScript, so the chart flattened out past 1000 donations.
-- Returns at most p_months rows regardless of table size.
CREATE OR REPLACE FUNCTION public.donation_monthly_totals(
  p_tenant_id uuid,
  p_months integer DEFAULT 12
)
RETURNS TABLE (month text, amount numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT month, amount
  FROM (
    SELECT
      to_char(date_trunc('month', coalesce(created_at, now())), 'YYYY-MM') AS month,
      sum(d.amount) AS amount
    FROM donations d
    WHERE d.tenant_id = p_tenant_id
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT GREATEST(1, LEAST(coalesce(p_months, 12), 60))
  ) recent
  ORDER BY month;
$$;

REVOKE ALL ON FUNCTION public.donation_monthly_totals(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donation_monthly_totals(uuid, integer) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_donations_tenant_created ON donations(tenant_id, created_at);

-- The sentiment page built its totals, issue breakdown, daily trend and ward
-- table by fetching every comment row, so past 1000 comments every figure on
-- the page was a prefix of the truth. Rolled up in SQL; the result is bounded
-- no matter how large the inbox gets.
CREATE OR REPLACE FUNCTION public.sentiment_rollup(
  p_tenant_id uuid,
  p_trend_days integer DEFAULT 14,
  p_wards integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total bigint := 0;
  v_positive bigint := 0;
  v_neutral bigint := 0;
  v_negative bigint := 0;
  v_issues jsonb := '[]'::jsonb;
  v_trend jsonb := '[]'::jsonb;
  v_wards jsonb := '[]'::jsonb;
  v_days integer := GREATEST(1, LEAST(coalesce(p_trend_days, 14), 120));
  v_ward_limit integer := GREATEST(1, LEAST(coalesce(p_wards, 10), 100));
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE sentiment = 'positive'),
    count(*) FILTER (WHERE sentiment = 'neutral'),
    count(*) FILTER (WHERE sentiment = 'negative')
  INTO v_total, v_positive, v_neutral, v_negative
  FROM comments WHERE tenant_id = p_tenant_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('topic', topic, 'count', n) ORDER BY n DESC), '[]'::jsonb)
  INTO v_issues
  FROM (
    SELECT issue_topic::text AS topic, count(*) AS n
    FROM comments
    WHERE tenant_id = p_tenant_id AND issue_topic IS NOT NULL
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 30
  ) s;

  -- Ordered oldest-first so the chart can render the array as given.
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('date', day, 'positive', positive, 'neutral', neutral, 'negative', negative)
      ORDER BY day
    ),
    '[]'::jsonb
  )
  INTO v_trend
  FROM (
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      count(*) FILTER (WHERE sentiment = 'positive') AS positive,
      count(*) FILTER (WHERE sentiment = 'neutral' OR sentiment IS NULL) AS neutral,
      count(*) FILTER (WHERE sentiment = 'negative') AS negative
    FROM comments
    WHERE tenant_id = p_tenant_id AND created_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT v_days
  ) d;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('ward', ward, 'total', total, 'positive', positive, 'neutral', neutral, 'negative', negative)
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO v_wards
  FROM (
    SELECT
      coalesce(nullif(btrim(ward), ''), 'Unknown') AS ward,
      count(*) AS total,
      count(*) FILTER (WHERE sentiment = 'positive') AS positive,
      count(*) FILTER (WHERE sentiment = 'neutral' OR sentiment IS NULL) AS neutral,
      count(*) FILTER (WHERE sentiment = 'negative') AS negative
    FROM comments
    WHERE tenant_id = p_tenant_id
    GROUP BY 1
    ORDER BY total DESC
    LIMIT v_ward_limit
  ) w;

  RETURN jsonb_build_object(
    'total', v_total,
    'sentiment', jsonb_build_object('positive', v_positive, 'neutral', v_neutral, 'negative', v_negative),
    'issues', v_issues,
    'trend', v_trend,
    'wards', v_wards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sentiment_rollup(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sentiment_rollup(uuid, integer, integer) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_comments_tenant_created ON comments(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_ward ON comments(tenant_id, ward);

-- Aggregates scan the whole tenant slice; without these they are seq scans.
CREATE INDEX IF NOT EXISTS idx_donations_tenant ON donations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_status ON comments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_sentiment ON comments(tenant_id, sentiment);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant ON social_posts(tenant_id);

NOTIFY pgrst, 'reload schema';
