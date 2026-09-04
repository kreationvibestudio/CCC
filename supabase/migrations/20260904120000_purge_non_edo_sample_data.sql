-- Scope Situation Room / register totals to Edo campaign PUs only.
-- Also add a one-shot purge for leftover Lagos/Abuja sample geography + demo CRM rows.

CREATE OR REPLACE FUNCTION public.election_universe_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pu_count', count(*),
    'registered_voters', coalesce(sum(registered_voters), 0)
  )
  FROM polling_units u
  WHERE u.tenant_id = public.current_tenant_id()
    AND public.campaign_polling_unit(u);
$$;

CREATE OR REPLACE FUNCTION public.purge_non_edo_sample_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  pruned_total integer := 0;
  batch jsonb;
  n_volunteers integer := 0;
  n_contacts integer := 0;
  n_events integer := 0;
  n_activities integer := 0;
  n_comments integer := 0;
  n_donations integer := 0;
  non_edo_lgas text[] := ARRAY[
    'ikeja','epe','amac','lagos island','lagos mainland','alimosho','surulere',
    'eti-osa','kosofe','mushin','oshodi-isolo','agege','ajeromi-ifelodun','apapa',
    'badagry','ifako-ijaiye','ojo','shomolu','lagos','abuja','fct','municipal area council'
  ];
  non_edo_wards text[] := ARRAY[
    'alausa','oregun','epe town','garki','maitama','wuse','ikeja','secretariat'
  ];
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Unknown workspace';
  END IF;

  -- Remove every non-Edo polling unit (and dependent election rows).
  LOOP
    batch := public.prune_non_campaign_polling_units(p_tenant_id, 5000);
    pruned_total := pruned_total + coalesce((batch->>'pruned')::integer, 0);
    EXIT WHEN coalesce((batch->>'pruned')::integer, 0) = 0;
  END LOOP;

  -- Sample volunteers tied to Lagos / Abuja wards-LGAs (not Edo).
  WITH doomed AS (
    DELETE FROM public.volunteers v
    WHERE v.tenant_id = p_tenant_id
      AND (
        lower(coalesce(v.lga, '')) = ANY (non_edo_lgas)
        OR lower(coalesce(v.ward, '')) = ANY (non_edo_wards)
        OR lower(coalesce(v.polling_unit, '')) ~ '(lagos|abuja|ikeja|epe|amac|fct)'
      )
    RETURNING 1
  )
  SELECT count(*) INTO n_volunteers FROM doomed;

  -- Donations that point at non-Edo sample contacts (FK has no ON DELETE).
  WITH doomed_contacts AS (
    SELECT c.id
    FROM public.contacts c
    WHERE c.tenant_id = p_tenant_id
      AND (
        lower(coalesce(c.lga, '')) = ANY (non_edo_lgas)
        OR lower(coalesce(c.ward, '')) = ANY (non_edo_wards)
      )
  ),
  doomed AS (
    DELETE FROM public.donations d
    WHERE d.tenant_id = p_tenant_id
      AND d.contact_id IN (SELECT id FROM doomed_contacts)
    RETURNING 1
  )
  SELECT count(*) INTO n_donations FROM doomed;

  WITH doomed AS (
    DELETE FROM public.contacts c
    WHERE c.tenant_id = p_tenant_id
      AND (
        lower(coalesce(c.lga, '')) = ANY (non_edo_lgas)
        OR lower(coalesce(c.ward, '')) = ANY (non_edo_wards)
      )
    RETURNING 1
  )
  SELECT count(*) INTO n_contacts FROM doomed;

  WITH doomed AS (
    DELETE FROM public.campaign_events e
    WHERE e.tenant_id = p_tenant_id
      AND (
        lower(coalesce(e.title, '')) ~ '(lagos|ikeja|epe|abuja|fct|tafawa)'
        OR lower(coalesce(e.location, '')) ~ '(lagos|ikeja|epe|abuja|fct|tafawa|balewa)'
        OR lower(coalesce(e.lga, '')) = ANY (non_edo_lgas)
        OR lower(coalesce(e.ward, '')) = ANY (non_edo_wards)
      )
    RETURNING 1
  )
  SELECT count(*) INTO n_events FROM doomed;

  -- Sample feed activities that still name non-Edo places, or orphan demo donation stubs.
  WITH doomed AS (
    DELETE FROM public.activities a
    WHERE a.tenant_id = p_tenant_id
      AND (
        lower(a.description) ~ '(ikeja|epe|lagos|abuja|alausa|oregun|tafawa|balewa|amac|garki)'
        OR lower(a.action) ~ '(ikeja|epe|lagos|abuja)'
        OR (
          a.action = 'donation.received'
          AND lower(a.description) ~ 'david okon'
        )
      )
    RETURNING 1
  )
  SELECT count(*) INTO n_activities FROM doomed;

  WITH doomed AS (
    DELETE FROM public.comments c
    WHERE c.tenant_id = p_tenant_id
      AND (
        lower(coalesce(c.lga, '')) = ANY (non_edo_lgas)
        OR lower(coalesce(c.ward, '')) = ANY (non_edo_wards)
        OR lower(coalesce(c.location, '')) ~ '(ikeja|epe|lagos|abuja|alausa|oregun|amac|garki)'
        OR lower(c.content) ~ '(ikeja|epe|lagos|abuja|alausa|oregun)'
      )
    RETURNING 1
  )
  SELECT count(*) INTO n_comments FROM doomed;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', p_tenant_id,
    'polling_units_pruned', pruned_total,
    'volunteers_removed', n_volunteers,
    'contacts_removed', n_contacts,
    'events_removed', n_events,
    'activities_removed', n_activities,
    'comments_removed', n_comments,
    'donations_removed', n_donations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_non_edo_sample_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_non_edo_sample_data(uuid) TO service_role;
