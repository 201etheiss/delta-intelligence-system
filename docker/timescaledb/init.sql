-- TimescaleDB initialization for Delta Intelligence time-series data
-- Separate from Supabase — dedicated to time-series workloads

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Fuel price history
CREATE TABLE IF NOT EXISTS fuel_prices (
  time TIMESTAMPTZ NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'delta360',
  product TEXT NOT NULL,          -- ULSD, unleaded, premium, etc.
  location_id TEXT,
  rack_price NUMERIC(10, 4),
  retail_price NUMERIC(10, 4),
  margin NUMERIC(10, 4),
  source TEXT,                    -- DTN, OPIS, manual
  metadata JSONB DEFAULT '{}'
);

SELECT create_hypertable('fuel_prices', 'time', if_not_exists => TRUE);
CREATE INDEX idx_fuel_prices_product ON fuel_prices(product, time DESC);
CREATE INDEX idx_fuel_prices_tenant ON fuel_prices(tenant_id, time DESC);

-- Fleet telemetry (Samsara, Fleet Panda)
CREATE TABLE IF NOT EXISTS fleet_telemetry (
  time TIMESTAMPTZ NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'delta360',
  vehicle_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,      -- gps, fuel_level, odometer, engine_hours, fault_code
  value NUMERIC,
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  metadata JSONB DEFAULT '{}'
);

SELECT create_hypertable('fleet_telemetry', 'time', if_not_exists => TRUE);
CREATE INDEX idx_fleet_vehicle ON fleet_telemetry(vehicle_id, time DESC);
CREATE INDEX idx_fleet_metric ON fleet_telemetry(metric_type, time DESC);

-- KPI trend tracking
CREATE TABLE IF NOT EXISTS kpi_trends (
  time TIMESTAMPTZ NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'delta360',
  kpi_name TEXT NOT NULL,         -- revenue, gp_margin, dso, ar_aging, etc.
  value NUMERIC NOT NULL,
  period_type TEXT DEFAULT 'daily', -- daily, weekly, monthly
  dimensions JSONB DEFAULT '{}',  -- department, region, product line
  metadata JSONB DEFAULT '{}'
);

SELECT create_hypertable('kpi_trends', 'time', if_not_exists => TRUE);
CREATE INDEX idx_kpi_name ON kpi_trends(kpi_name, time DESC);
CREATE INDEX idx_kpi_tenant ON kpi_trends(tenant_id, time DESC);
