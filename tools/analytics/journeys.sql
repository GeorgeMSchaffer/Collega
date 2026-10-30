-- Journey queries over audit_events alone (draft, 2026-10-27).
-- Each query stands on its own. Shared rules, repeated in each:
--   * "active" = a contributing action; sign-ins, View As and failed logins don't count.
--   * Site Admins and anything done through View As are excluded.
--   * An event's organization falls back to the actor's when the row has none.

-- 1. Activation funnel per organization: how far each org got, and how fast.
WITH contributing AS (
    SELECT
        COALESCE(ae.organization_id, actor.organization_id) AS organization_id,
        ae.actor_user_id,
        ae.event_type,
        ae.occurred_at_utc
    FROM audit_events AS ae
    JOIN users AS actor ON actor.id = ae.actor_user_id
    WHERE actor.role <> 'SiteAdmin'
      AND ae.on_behalf_of_user_id IS NULL
      AND ae.event_type NOT LIKE 'Auth%'
      AND ae.event_type NOT LIKE 'ViewAs%'
),
third_user AS (
    SELECT ranked.organization_id, ranked.first_at AS third_user_at
    FROM (
        SELECT
            c.organization_id,
            MIN(c.occurred_at_utc) AS first_at,
            ROW_NUMBER() OVER (PARTITION BY c.organization_id ORDER BY MIN(c.occurred_at_utc)) AS user_rank
        FROM contributing AS c
        GROUP BY c.organization_id, c.actor_user_id
    ) AS ranked
    WHERE ranked.user_rank = 3
)
SELECT
    org.title AS organization,
    org.created_at_utc::date AS org_created,
    MIN(c.occurred_at_utc) FILTER (WHERE c.event_type = 'BoardCreated') - org.created_at_utc AS to_first_board,
    MIN(c.occurred_at_utc) FILTER (WHERE c.event_type IN ('IdeaCreated', 'IdeasImported')) - org.created_at_utc AS to_first_idea,
    MIN(c.occurred_at_utc) FILTER (WHERE c.event_type = 'CommentCreated') - org.created_at_utc AS to_first_comment,
    MIN(c.occurred_at_utc) FILTER (WHERE c.event_type = 'IdeaStatusChanged') - org.created_at_utc AS to_first_status_move,
    tu.third_user_at - org.created_at_utc AS to_third_active_user,
    COUNT(DISTINCT c.actor_user_id) AS active_users_ever
FROM organizations AS org
LEFT JOIN contributing AS c ON c.organization_id = org.id
LEFT JOIN third_user AS tu ON tu.organization_id = org.id
WHERE NOT org.is_archived
GROUP BY org.id, org.title, org.created_at_utc, tu.third_user_at
ORDER BY org.created_at_utc DESC;

-- 2. First board: who made it, how soon, and whether it got used in its first 14 days.
WITH first_board AS (
    SELECT DISTINCT ON (b.organization_id)
        b.organization_id,
        b.id AS board_id,
        b.created_at_utc,
        creator.role AS creator_role
    FROM boards AS b
    LEFT JOIN users AS creator ON creator.id = b.created_by_user_id
    ORDER BY b.organization_id, b.created_at_utc
),
board_activity AS (
    SELECT
        fb.organization_id,
        COUNT(*) FILTER (WHERE ae.event_type IN ('IdeaCreated', 'BoardTaskCreated')) AS items_added_14d,
        COUNT(*) FILTER (WHERE ae.event_type = 'IdeaStatusChanged') AS status_moves_14d,
        COUNT(DISTINCT ae.actor_user_id) AS people_14d
    FROM first_board AS fb
    JOIN audit_events AS ae
      ON ae.occurred_at_utc >= fb.created_at_utc
     AND ae.occurred_at_utc < fb.created_at_utc + INTERVAL '14 days'
     AND ae.entity_type = 'Idea'
    -- Most idea events carry no boardId, so the board comes from the idea's current row.
    JOIN ideas AS i ON i.id = ae.entity_id AND i.board_id = fb.board_id
    JOIN users AS actor ON actor.id = ae.actor_user_id
    WHERE actor.role <> 'SiteAdmin'
      AND ae.on_behalf_of_user_id IS NULL
    GROUP BY fb.organization_id
)
SELECT
    org.title AS organization,
    fb.created_at_utc - org.created_at_utc AS to_first_board,
    fb.creator_role,
    COALESCE(ba.items_added_14d, 0) AS items_added_14d,
    COALESCE(ba.status_moves_14d, 0) AS status_moves_14d,
    COALESCE(ba.people_14d, 0) AS people_14d
FROM organizations AS org
LEFT JOIN first_board AS fb ON fb.organization_id = org.id
LEFT JOIN board_activity AS ba ON ba.organization_id = org.id
WHERE NOT org.is_archived
ORDER BY to_first_board NULLS LAST;

-- 3. Weekly retention by organization: share of members active N weeks after the org's first active week.
WITH contributing AS (
    SELECT
        COALESCE(ae.organization_id, actor.organization_id) AS organization_id,
        ae.actor_user_id,
        date_trunc('week', ae.occurred_at_utc) AS active_week
    FROM audit_events AS ae
    JOIN users AS actor ON actor.id = ae.actor_user_id
    WHERE actor.role <> 'SiteAdmin'
      AND ae.on_behalf_of_user_id IS NULL
      AND ae.event_type NOT LIKE 'Auth%'
      AND ae.event_type NOT LIKE 'ViewAs%'
),
org_start AS (
    SELECT c.organization_id, MIN(c.active_week) AS cohort_week
    FROM contributing AS c
    GROUP BY c.organization_id
),
members AS (
    SELECT u.organization_id, COUNT(*) AS member_count
    FROM users AS u
    WHERE u.role <> 'SiteAdmin' AND u.status = 'Active'
    GROUP BY u.organization_id
)
SELECT
    org.title AS organization,
    os.cohort_week::date AS cohort_week,
    (EXTRACT(EPOCH FROM c.active_week - os.cohort_week) / 604800)::int AS week_number,
    COUNT(DISTINCT c.actor_user_id) AS active_users,
    m.member_count,
    ROUND(100.0 * COUNT(DISTINCT c.actor_user_id) / NULLIF(m.member_count, 0), 1) AS pct_active
FROM contributing AS c
JOIN org_start AS os ON os.organization_id = c.organization_id
JOIN organizations AS org ON org.id = c.organization_id
LEFT JOIN members AS m ON m.organization_id = c.organization_id
WHERE c.active_week < os.cohort_week + INTERVAL '9 weeks'
GROUP BY org.title, os.cohort_week, week_number, m.member_count
ORDER BY org.title, week_number;

-- 4. User activation by signup week: signed in, contributed in week one, came back in weeks 2-4.
WITH signups AS (
    SELECT u.id AS user_id, u.created_at_utc, date_trunc('week', u.created_at_utc) AS signup_week
    FROM users AS u
    WHERE u.role <> 'SiteAdmin'
),
own_events AS (
    SELECT ae.actor_user_id AS user_id, ae.event_type, ae.occurred_at_utc
    FROM audit_events AS ae
    WHERE ae.on_behalf_of_user_id IS NULL
)
SELECT
    s.signup_week::date AS signup_week,
    COUNT(*) AS signups,
    ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM own_events AS e
        WHERE e.user_id = s.user_id AND e.event_type = 'AuthLoginSucceeded'
          AND e.occurred_at_utc < s.created_at_utc + INTERVAL '7 days'
    )) / COUNT(*), 1) AS pct_signed_in_wk1,
    ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM own_events AS e
        WHERE e.user_id = s.user_id
          AND e.event_type IN ('IdeaCreated', 'IdeaUpdated', 'CommentCreated', 'IdeaUpvoteAdded', 'IdeaStatusChanged')
          AND e.occurred_at_utc < s.created_at_utc + INTERVAL '7 days'
    )) / COUNT(*), 1) AS pct_contributed_wk1,
    ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM own_events AS e
        WHERE e.user_id = s.user_id
          AND e.event_type NOT LIKE 'Auth%' AND e.event_type NOT LIKE 'ViewAs%'
          AND e.occurred_at_utc >= s.created_at_utc + INTERVAL '7 days'
          AND e.occurred_at_utc < s.created_at_utc + INTERVAL '28 days'
    )) / COUNT(*), 1) AS pct_returned_wk2_4
FROM signups AS s
GROUP BY s.signup_week
ORDER BY s.signup_week DESC;
