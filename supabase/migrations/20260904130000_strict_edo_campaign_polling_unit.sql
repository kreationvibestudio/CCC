-- National dumps often use INEC-style "12/…" codes (or a blanketed state_code=12)
-- without being Edo geography. Treat those as non-campaign unless the row is
-- clearly Edo by state name, campaign EDO/ code, or an official Edo LGA.

CREATE OR REPLACE FUNCTION public.edo_campaign_lga(p_lga text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(p_lga, ''), '[^a-z0-9]+', '', 'g')) = ANY (ARRAY[
    'akokoedo',
    'egor',
    'esancentral',
    'esannortheast',
    'esansoutheast',
    'esanwest',
    'etsakocentral',
    'etsakoeast',
    'etsakowest',
    'igueben',
    'ikpobaokha',
    'oredo',
    'orhionmwon',
    'ovianortheast',
    'oviasouthwest',
    'owaneast',
    'owanwest',
    'uhunmwonde',
    'uhunmwode'
  ]);
$$;

REVOKE ALL ON FUNCTION public.edo_campaign_lga(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edo_campaign_lga(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.campaign_polling_unit(u polling_units)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(u.state, '') ILIKE 'EDO%'
    OR coalesce(u.code, '') ILIKE 'EDO/%'
    OR public.edo_campaign_lga(u.lga);
$$;

REVOKE ALL ON FUNCTION public.campaign_polling_unit(polling_units) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_polling_unit(polling_units) TO authenticated, service_role;
