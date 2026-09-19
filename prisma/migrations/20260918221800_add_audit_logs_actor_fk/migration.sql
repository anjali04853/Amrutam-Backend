-- The partitioning migration (partition_audit_logs) recreated audit_logs as a
-- partitioned table but did not carry over the original actorId -> users(id)
-- foreign key. audit_logs is a compliance audit-trail table, so restore the
-- referential guarantee. Postgres supports foreign keys on partitioned tables
-- referencing a non-partitioned table; this validates against all existing
-- partitions automatically. ON DELETE SET NULL matches the original schema's
-- Prisma relation semantics: an audit row survives if the referenced user is
-- later deleted, with actorId nulled out rather than the audit row being
-- removed.

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actorid_fkey
  FOREIGN KEY ("actorId") REFERENCES users(id)
  ON DELETE SET NULL;
