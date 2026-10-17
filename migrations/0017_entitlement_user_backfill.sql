-- Entitlements are keyed by user_id. A row whose user_id is not an account any
-- more, but whose email belongs to exactly one account that has no entitlement
-- row yet, is handed to that account. Rows that belong to a real account are
-- never moved, so a stranger who signs up with someone's billing email gets
-- nothing from this.

update entitlements e
set user_id = m.id, updated_at = now()
from (
  select lower(u.email) as em, min(u.id) as id
  from "user" u
  group by lower(u.email)
  having count(*) = 1
) m
where lower(e.email) = m.em
  and e.email <> ''
  and not exists (select 1 from "user" x where x.id = e.user_id)
  and not exists (select 1 from entitlements o where o.user_id = m.id)
  and (
    select count(*) from entitlements e2
    where lower(e2.email) = m.em
      and not exists (select 1 from "user" x2 where x2.id = e2.user_id)
  ) = 1;
