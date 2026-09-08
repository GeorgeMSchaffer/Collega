-- Promote the nine EF-era enum columns to the native Postgres enum types `schema.prisma` declares.
--
-- WHY THIS IS NOT A PRISMA MIGRATION. It repairs one specific database - the EF-migrated one
-- described in `SPEC/decisions.md` 2026-09-07 - and does nothing on a database created from the
-- baseline, which already has all nine types. Putting it in `prisma/migrations/` would add a
-- permanent step to a chain every fresh database replays, to fix a state no fresh database is ever
-- in. It is run once, by hand, against the database that needs it.
--
-- WHAT IT HANDLES. EF stored these two ways and the live database has both: five columns as
-- `character varying` (configured with a string conversion) and four as `integer` (the EF default,
-- an ordinal). Each column is converted from whichever shape it is actually in, so this does not
-- depend on the audit being complete or on both databases having drifted identically.
--
-- THE TRAP. `FieldType` is **1-based** (`Text = 1 ... Url = 7`); every other enum here is 0-based.
-- A single ordinal map shifts every field type by one **and still commits**, because 1..7 are all
-- valid indexes into a 7-label array - it just silently relabels Text as Number, and so on down the
-- list. The `base` column below is the whole defence, and is why the mapping is data rather than
-- nine hand-written casts.
--
-- IDEMPOTENT. A column already of the right type is skipped, so a re-run is a no-op and a partial
-- run can be resumed. Wrap it in a transaction; on Postgres, DDL is transactional.
--
-- BEFORE RUNNING: take a dump. `pg_dump -Fc` is a minute, and this rewrites nine columns in place.

BEGIN;

DO $$
DECLARE
  spec record;
  current_type text;
  labels_sql text;
  quoted_enum text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- table, column, enum type, labels in ordinal order, first ordinal
      ('users',                  'role',        'Role',                   ARRAY['SiteAdmin','OrgAdmin','User','ReadOnly'], 0),
      ('users',                  'status',      'UserStatus',             ARRAY['Active','Inactive'], 0),
      ('notification_events',    'event_type',  'NotificationEventType',  ARRAY['IdeaMention','CommentMention','CommentOnIdea'], 0),
      ('ai_usage_records',       'outcome',     'AiCallOutcome',          ARRAY['Success','Error','RateLimited','BudgetExceeded'], 0),
      ('ai_usage_records',       'key_source',  'AiKeySource',            ARRAY['Deployment','Organization'], 0),
      ('ideas',                  'priority',    'Priority',               ARRAY['Low','Medium','High','Critical'], 0),
      ('idea_types',             'field_mode',  'IdeaTypeFieldMode',      ARRAY['AllActiveFields','Curated'], 0),
      ('impersonation_sessions', 'end_reason',  'ImpersonationEndReason', ARRAY['ExitedByUser','IdleTimeout','AbsoluteTimeout','TargetNoLongerValid','RealUserNoLongerAuthorized'], 0),
      -- 1-based. See THE TRAP above.
      ('field_definitions',      'field_type',  'FieldType',              ARRAY['Text','Number','Date','Boolean','Dropdown','MultiSelect','Url'], 1)
    ) AS t(table_name, column_name, enum_name, labels, base)
  LOOP
    quoted_enum := format('%I', spec.enum_name);

    -- The type first: a column cannot be cast to something that does not exist. CREATE TYPE has no
    -- IF NOT EXISTS, hence the lookup.
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = spec.enum_name AND n.nspname = 'public' AND t.typtype = 'e'
    ) THEN
      SELECT string_agg(format('%L', label), ', ' ORDER BY ordinality)
        INTO labels_sql
        FROM unnest(spec.labels) WITH ORDINALITY AS u(label, ordinality);
      EXECUTE format('CREATE TYPE public.%s AS ENUM (%s)', quoted_enum, labels_sql);
      RAISE NOTICE 'created type %', spec.enum_name;
    END IF;

    SELECT data_type INTO current_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = spec.table_name
       AND column_name = spec.column_name;

    IF current_type IS NULL THEN
      RAISE EXCEPTION 'no column %.%', spec.table_name, spec.column_name;
    END IF;

    IF current_type = 'USER-DEFINED' THEN
      RAISE NOTICE 'skipping %.% - already an enum', spec.table_name, spec.column_name;
      CONTINUE;
    END IF;

    -- A default referencing the old type blocks the cast, and would be invalid afterwards anyway.
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT',
                   spec.table_name, spec.column_name);

    IF current_type = 'integer' THEN
      -- Postgres arrays are 1-indexed, so a 0-based ordinal needs +1 and a 1-based one needs +0.
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE public.%s USING (%L::text[])[%I + %s]::public.%s',
        spec.table_name, spec.column_name, quoted_enum, spec.labels,
        spec.column_name, 1 - spec.base, quoted_enum);
    ELSE
      -- Text form: the stored value is already the label, so the cast validates it. A row holding
      -- anything not in the enum fails here, loudly, which is the correct outcome - it is data the
      -- new schema cannot represent and someone has to decide what it should become.
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE public.%s USING %I::text::public.%s',
                     spec.table_name, spec.column_name, quoted_enum, spec.column_name, quoted_enum);
    END IF;

    RAISE NOTICE 'converted %.% from %', spec.table_name, spec.column_name, current_type;
  END LOOP;
END $$;

-- The one default the schema declares, restored now that the column can hold it again.
ALTER TABLE public.idea_types ALTER COLUMN field_mode SET DEFAULT 'AllActiveFields';

COMMIT;
