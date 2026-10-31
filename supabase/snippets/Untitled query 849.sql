-- Annual workspace licensing: keys, active entitlement, payment history.

CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'available'
          CHECK (status IN ('available', 'redeemed', 'revoked')),
            term_days INTEGER NOT NULL DEFAULT 365 CHECK (term_days > 0),
              amount_naira NUMERIC(12, 2),
                currency TEXT NOT NULL DEFAULT 'NGN',
                  notes TEXT,
                    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                      redeemed_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
                        redeemed_at TIMESTAMPTZ,
                          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                          );

                          CREATE INDEX IF NOT EXISTS license_keys_status_idx ON public.license_keys (status);

                          CREATE TABLE IF NOT EXISTS public.tenant_licenses (
                            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                              tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
                                license_key TEXT NOT NULL,
                                  status TEXT NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'grace', 'expired', 'suspended')),
                                        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                          expires_at TIMESTAMPTZ NOT NULL,
                                            grace_ends_at TIMESTAMPTZ,
                                              amount_naira NUMERIC(12, 2),
                                                currency TEXT NOT NULL DEFAULT 'NGN',
                                                  issued_to_email TEXT,
                                                    issued_to_name TEXT,
                                                      last_payment_reference TEXT,
                                                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                                                            );

                                                            CREATE INDEX IF NOT EXISTS tenant_licenses_expires_at_idx ON public.tenant_licenses (expires_at);

                                                            CREATE TABLE IF NOT EXISTS public.tenant_license_payments (
                                                              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                                                tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
                                                                  license_id UUID REFERENCES public.tenant_licenses(id) ON DELETE SET NULL,
                                                                    amount NUMERIC(12, 2) NOT NULL,
                                                                      currency TEXT NOT NULL DEFAULT 'NGN',
                                                                        payment_method TEXT,
                                                                          payment_reference TEXT NOT NULL,
                                                                            period_start TIMESTAMPTZ NOT NULL,
                                                                              period_end TIMESTAMPTZ NOT NULL,
                                                                                payer_email TEXT,
                                                                                  license_key_issued TEXT,
                                                                                    raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                                                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                                                        UNIQUE (tenant_id, payment_reference)
                                                                                        );

                                                                                        ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
                                                                                        ALTER TABLE public.tenant_licenses ENABLE ROW LEVEL SECURITY;
                                                                                        ALTER TABLE public.tenant_license_payments ENABLE ROW LEVEL SECURITY;

                                                                                        -- HQ can read their own license; writes go through service role.
                                                                                        DROP POLICY IF EXISTS tenant_licenses_select ON public.tenant_licenses;
                                                                                        CREATE POLICY tenant_licenses_select ON public.tenant_licenses
                                                                                          FOR SELECT USING (tenant_id = public.current_tenant_id());

                                                                                          DROP POLICY IF EXISTS tenant_license_payments_select ON public.tenant_license_payments;
                                                                                          CREATE POLICY tenant_license_payments_select ON public.tenant_license_payments
                                                                                            FOR SELECT USING (tenant_id = public.current_tenant_id());

                                                                                            -- license_keys are platform inventory — no authenticated tenant access
                                                                                            DROP POLICY IF EXISTS license_keys_deny ON public.license_keys;
                                                                                            CREATE POLICY license_keys_deny ON public.license_keys
                                                                                              FOR SELECT USING (false);

                                                                                              GRANT SELECT ON public.tenant_licenses TO authenticated;
                                                                                              GRANT SELECT ON public.tenant_license_payments TO authenticated;
                                                                                              GRANT ALL ON public.license_keys TO service_role;
                                                                                              GRANT ALL ON public.tenant_licenses TO service_role;
                                                                                              GRANT ALL ON public.tenant_license_payments TO service_role;

                                                                                              COMMENT ON TABLE public.license_keys IS 'Sellable/redeemable annual CCC workspace license keys';
                                                                                              COMMENT ON TABLE public.tenant_licenses IS 'Active annual entitlement per workspace';
                                                                                              COMMENT ON TABLE public.tenant_license_payments IS 'Paystack (and other) renewals for workspace licenses';

                                                                                              -- Grandfather existing workspaces with one year so production is not locked out on migrate.
                                                                                              INSERT INTO public.tenant_licenses (
                                                                                                tenant_id,
                                                                                                  license_key,
                                                                                                    status,
                                                                                                      starts_at,
                                                                                                        expires_at,
                                                                                                          grace_ends_at,
                                                                                                            amount_naira,
                                                                                                              currency,
                                                                                                                metadata
                                                                                                                )
                                                                                                                SELECT
                                                                                                                  t.id,
                                                                                                                    'CCC-LEGACY-' || upper(substr(replace(t.id::text, '-', ''), 1, 4))
                                                                                                                        || '-' || upper(substr(replace(t.id::text, '-', ''), 5, 4))
                                                                                                                            || '-' || upper(substr(replace(t.id::text, '-', ''), 9, 4))
                                                                                                                                || '-' || upper(substr(replace(t.id::text, '-', ''), 13, 4)),
                                                                                                                                  'active',
                                                                                                                                    NOW(),
                                                                                                                                      NOW() + INTERVAL '365 days',
                                                                                                                                        NOW() + INTERVAL '372 days',
                                                                                                                                          0,
                                                                                                                                            'NGN',
                                                                                                                                              jsonb_build_object('grandfathered', true, 'source', 'migration_20261031220000')
                                                                                                                                              FROM public.tenants t
                                                                                                                                              WHERE NOT EXISTS (
                                                                                                                                                SELECT 1 FROM public.tenant_licenses tl WHERE tl.tenant_id = t.id
                                                                                                                                                );

                                                                                                                                                NOTIFY pgrst, 'reload schema';
                                                                                                                                                