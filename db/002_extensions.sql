-- Run once against the existing database:  psql "<conn string>" -f db/002_extensions.sql
ALTER TABLE zones  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz;
ALTER TABLE zones  ADD COLUMN IF NOT EXISTS gateway_online boolean NOT NULL DEFAULT true;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_seen timestamptz;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS checked_out boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_events_time         ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_anomaly_time ON events (created_at DESC) WHERE is_anomaly;
CREATE INDEX IF NOT EXISTS idx_checkouts_window    ON authorized_checkouts (asset_id, valid_from, valid_until);



postgres=> SELECT asset_id, tag_id FROM assets;
 asset_id | tag_id
----------+--------
        2 |      2
        3 |      3
        4 |      4
        5 |      5
        6 |      6
        1 |      1
(6 rows)
