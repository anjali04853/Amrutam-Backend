-- Convert audit_logs to a partitioned table, range-partitioned by month on createdAt.
-- Prisma's migration diffing does not model partitioned tables directly, so this
-- migration is hand-written: rename the existing table, recreate it as PARTITION BY
-- RANGE, migrate data, then create the current and next month's partitions.

ALTER TABLE audit_logs RENAME TO audit_logs_old;

CREATE TABLE audit_logs (
  id            TEXT NOT NULL,
  "actorId"     TEXT,
  action        TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId"  TEXT NOT NULL,
  before        JSONB,
  after         JSONB,
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (id, "createdAt")
) PARTITION BY RANGE ("createdAt");

CREATE INDEX audit_logs_resource_idx ON audit_logs ("resourceType", "resourceId");
CREATE INDEX audit_logs_actor_idx ON audit_logs ("actorId");

-- Create partitions for the current month and the following 2 months.
DO $$
DECLARE
  month_start date := date_trunc('month', now());
  i int;
BEGIN
  FOR i IN 0..2 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS audit_logs_%s PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
      to_char(month_start + (i || ' month')::interval, 'YYYY_MM'),
      month_start + (i || ' month')::interval,
      month_start + ((i + 1) || ' month')::interval
    );
  END LOOP;
END $$;

INSERT INTO audit_logs (id, "actorId", action, "resourceType", "resourceId", before, after, "ipAddress", "createdAt")
  SELECT id, "actorId", action, "resourceType", "resourceId", before, after, "ipAddress", "createdAt" FROM audit_logs_old;

DROP TABLE audit_logs_old;
