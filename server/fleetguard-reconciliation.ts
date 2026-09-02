", "cost", "amount", "total_cost",
  "odometer_km", "odometer", "mileage", "fuel_type", "fueltype",
  "photo_url", "receipt_photo", "receipt_url", "slip_url", "slip_data", "slip_mime",
  "slip_image_data", "slip_image_name", "slip_image_mime_type",
  "receipt_data", "receipt_mime", "photo_data", "photo_mime",
]);

/**
 * Fuel-station data must not cross the FleetGuard/JobFlow boundary. This
 * deliberately removes only exact key names (case-insensitively), so unrelated
 * concepts such as pest-control bait stations remain intact. Objects and arrays
 * are copied rather than mutated because source rows are also used for planning.
 *
 * FleetGuard has historically put JSON into notes/metadata fields. When those
 * fields contain JSON, scrub their nested station keys too; ordinary note text
 * is retained unchanged.
 */
export function stripFuelStationData<T>(value: T, parentKey?: string): T {
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) {
    return value.map(item => stripFuelStationData(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !STATION_SOURCE_KEYS.has(key.toLowerCase()))
        .map(([key, item]) => [key, stripFuelStationData(item, key)]),
    ) as T;
  }
  if (
    typeof value === "string"
    && parentKey
    && ["notes", "metadata", "meta", "metadata_json"].includes(parentKey.toLowerCase())
  ) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return JSON.stringify(stripFuelStationData(parsed)) as T;
    } catch {
      // Notes are commonly plain text and must not be changed merely because
      // they are not JSON.
    }
  }
  return value;
}

/**
 * Fuel logs cross a stricter boundary than other FleetGuard records.  Persist
 * only native-materialisation inputs; in particular, no free-form source
 * payload, station data, or OCR result can become durable JobFlow data.
 */
export function sanitizeFuelLog(row: SourceRow): SourceRow {
  const sanitized: SourceRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = key.toLowerCase();
    if (FUEL_LOG_ALLOWED_KEYS.has(normalized) && !normalized.includes("ocr")
      && !STATION_SOURCE_KEYS.has(normalized)) {
      const canonicalKey = normalized === "slip_image_data"
        ? "slip_data"
        : normalized === "slip_image_mime_type"
          ? "slip_mime"
          : normalized === "slip_image_name"
            ? "slip_name"
            : key;
      sanitized[canonicalKey] = stripFuelStationData(value);
    }
  }
  return sanitized;
}

const emptyCount = (): ReconciliationCount => ({
  source: 0,
  target: 0,
  imported: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  conflicted: 0,
  excluded: 0,
});

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function nativeSourceFingerprint(value: unknown): string {
  return createHash("sha256").update(stableJson(stripFuelStationData(value))).digest("hex");
}

export function sourceIdForRow(table: FleetGuardTable, row: SourceRow): string {
  if (typeof row.id === "string" && row.id.trim()) return row.id;
  const fingerprintRow = table === "fuel_logs" ? sanitizeFuelLog(row) : stripFuelStationData(row);
  return `fingerprint-${createHash("sha256")
    .update(`${table}:${stableJson(fingerprintRow)}`)
    .digest("hex")}`;
}

export const normalizeRegistration = (value: unknown): string =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const normalizeName = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

function sourceVehicleIds(rows: SourceRow[]): Set<string> {
  return new Set(
    rows
      .filter(row => normalizeRegistration(row.registration) === FORBIDDEN_REGISTRATION)
      .map(row => sourceIdForRow("vehicles", row)),
  );
}

function forbiddenPayloadIds(
  source: Partial<Record<FleetGuardTable, SourceRow[]>>, forbiddenVehicleIds: Set<string>,
): Set<string> {
  // Follow source foreign-key-shaped fields to a fixed point so a forbidden
  // vehicle's check/template child cannot slip through merely because it only
  // references its parent record.
  const forbidden = new Set(forbiddenVehicleIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const table of FLEETGUARD_TABLES) for (const row of source[table] ?? []) {
      if (table === "vehicles") continue;
      const referencesForbidden = Object.entries(row).some(([key, value]) =>
        (key.endsWith("_id") || key.endsWith("Id")) && typeof value === "string" && forbidden.has(value),
      );
      const id = sourceIdForRow(table, row);
      if (referencesForbidden && !forbidden.has(id)) {
        forbidden.add(id);
        changed = true;
      }
    }
  }
  return forbidden;
}

function isExcludedSourceRow(
  source: Partial<Record<FleetGuardTable, SourceRow[]>>, table: FleetGuardTable, row: SourceRow,
  forbiddenVehicleIds: Set<string>,
): boolean {
  if (table === "vehicles") return forbiddenVehicleIds.has(sourceIdForRow("vehicles", row));
  return forbiddenPayloadIds(source, forbiddenVehicleIds).has(sourceIdForRow(table, row));
}

/**
 * Pure planning function used by both the production importer and synthetic
 * idempotency/conflict tests. It never mutates a row or performs I/O.
 */
export function buildReconciliationPlan(
  source: Partial<Record<FleetGuardTable, SourceRow[]>>,
  existingMappings: Set<string> = new Set(),
): Pick<ReconciliationReport, "counts" | "conflicts" | "samples"> {
  const sanitizedSource = Object.fromEntries(
    Object.entries(source).map(([table, rows]) => [
      table,
      Array.isArray(rows) ? rows.map(row => stripFuelStationData(row)) : rows,
    ]),
  ) as Partial<Record<FleetGuardTable, SourceRow[]>>;
  const counts: Record<string, ReconciliationCount> = {};
  const conflicts: ReconciliationConflict[] = [];
  const samples: Array<Record<string, unknown>> = [];
  const sourceVehicles = sanitizedSource.vehicles ?? [];
  const forbiddenVehicleIds = sourceVehicleIds(sourceVehicles);

  for (const table of FLEETGUARD_TABLES) {
    const rows = sanitizedSource[table] ?? [];
    const count = (counts[table] ??= emptyCount());
    count.source = rows.length;
    count.target = Array.from(existingMappings).filter(key => key.startsWith(`${table}:`)).length;
    for (const row of rows) {
      const sourceId = sourceIdForRow(table, row);
      const key = `${table}:${sourceId}`;
        const excluded = isExcludedSourceRow(sanitizedSource, table, row, forbiddenVehicleIds);
      if (excluded) {
        count.excluded++;
        continue;
      }
      if (table === "vehicles" && !row.registration) {
        count.conflicted++;
        conflicts.push({
          entityType: "vehicles",
          sourceId,
          reason: "MISSING_REGISTRATION",
          details: { row },
        });
        continue;
      }
      if (existingMappings.has(key)) {
        count.unchanged++;
      } else {
        count.imported++;
      }
      if (samples.length < 25) {
        samples.push({
          entityType: table,
          sourceId,
          action: existingMappings.has(key) ? "unchanged" : "imported",
        });
      }
    }
  }

  return { counts, conflicts, samples };
}

const SOURCE_PAGE_SIZE = 100;
const SOURCE_STATEMENT_TIMEOUT_MS = 15_000;
const SOURCE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const FULL_READ_TABLES = new Set<FleetGuardTable>([
  "vehicles", "drivers", "inspection_templates", "monthly_check_items",
  "notification_settings", "push_subscriptions",
]);

type SourceTableShape = {
  cursorColumn: "updated_at" | "created_at" | null;
  idColumn: "id" | "key";
  columns: Set<string>;
};

export function sourceLookbackStart(watermark: Date | null, lookbackMs = SOURCE_LOOKBACK_MS): Date | null {
  return watermark ? new Date(watermark.getTime() - lookbackMs) : null;
}

function createPool(connectionString: string, readOnly: boolean): pg.Pool {
  if (!connectionString) {
    throw new Error("Missing database connection string");
  }
  return new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") || connectionString.includes("proxy.rlwy.net")
      ? { rejectUnauthorized: false }
      : false,
    statement_timeout: readOnly ? SOURCE_STATEMENT_TIMEOUT_MS : 60_000,
    query_timeout: readOnly ? SOURCE_STATEMENT_TIMEOUT_MS + 2_000 : 65_000,
    connectionTimeoutMillis: 15_000,
    options: readOnly
      ? `-c default_transaction_read_only=on -c statement_timeout=${SOURCE_STATEMENT_TIMEOUT_MS}`
      : undefined,
    max: readOnly ? 1 : 2,
  });
}

async function ensureReconciliationTables(target: TargetDatabase): Promise<void> {
  await target.query(`
    CREATE TABLE IF NOT EXISTS fleetguard_import_runs (
      id varchar PRIMARY KEY,
      source_system varchar NOT NULL,
      mode varchar NOT NULL CHECK (mode IN ('dry-run', 'apply')),
      status varchar NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      started_at timestamp NOT NULL,
      completed_at timestamp,
      source_snapshot_at timestamp,
      counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      error text
    );
    CREATE TABLE IF NOT EXISTS fleetguard_record_mappings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source_system varchar NOT NULL,
      entity_type varchar NOT NULL,
      source_id varchar NOT NULL,
      target_table varchar,
      target_id varchar,
      status varchar NOT NULL CHECK (status IN ('mapped', 'quarantined', 'excluded')),
      match_method varchar,
      source_created_at timestamp,
      last_seen_at timestamp NOT NULL DEFAULT now(),
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (source_system, entity_type, source_id)
    );
    CREATE INDEX IF NOT EXISTS fleetguard_record_mappings_target_idx
      ON fleetguard_record_mappings(target_table, target_id);
    CREATE TABLE IF NOT EXISTS fleetguard_conflicts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      import_run_id varchar NOT NULL REFERENCES fleetguard_import_runs(id),
      source_system varchar NOT NULL,
      entity_type varchar NOT NULL,
      source_id varchar NOT NULL,
      reason varchar NOT NULL,
      details_json jsonb NOT NULL,
      status varchar NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'ignored')),
      created_at timestamp NOT NULL DEFAULT now(),
      resolved_at timestamp,
      resolved_by varchar
    );
    CREATE INDEX IF NOT EXISTS fleetguard_conflicts_status_idx
      ON fleetguard_conflicts(status, entity_type);
    CREATE TABLE IF NOT EXISTS fleetguard_source_records (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source_system varchar NOT NULL,
      entity_type varchar NOT NULL,
      source_id varchar NOT NULL,
      payload_json jsonb NOT NULL,
      source_created_at timestamp,
      source_deleted boolean NOT NULL DEFAULT false,
      first_seen_at timestamp NOT NULL DEFAULT now(),
      last_seen_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (source_system, entity_type, source_id)
    );
    CREATE TABLE IF NOT EXISTS fleetguard_high_water_marks (
      source_system varchar NOT NULL,
      entity_type varchar NOT NULL,
      source_created_at timestamp,
      updated_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (source_system, entity_type)
    );
    ALTER TABLE fleetguard_high_water_marks
      ADD COLUMN IF NOT EXISTS source_id varchar;
    CREATE TABLE IF NOT EXISTS fleetguard_import_checkpoints (
      source_system varchar NOT NULL,
      entity_type varchar NOT NULL,
      import_run_id varchar NOT NULL REFERENCES fleetguard_import_runs(id),
      status varchar NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      page_number integer NOT NULL DEFAULT 0,
      cursor_timestamp timestamp,
      cursor_source_id varchar,
      rows_committed integer NOT NULL DEFAULT 0,
      counts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      error text,
      updated_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (source_system, entity_type)
    );
    ALTER TABLE vehicle_assignments ADD COLUMN IF NOT EXISTS unassigned_at timestamp;
    ALTER TABLE vehicle_assignments ADD COLUMN IF NOT EXISTS source_system varchar;
    ALTER TABLE vehicle_assignments ADD COLUMN IF NOT EXISTS source_assignment_id varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS vehicle_assignments_source_unique
      ON vehicle_assignments(source_system, source_assignment_id)
      WHERE source_system IS NOT NULL AND source_assignment_id IS NOT NULL;
  `);
}

async function ensureAssignmentExclusivity(target: TargetDatabase): Promise<void> {
  const duplicates = await target.query(
    `SELECT vehicle_id, count(*)::int AS active_count
       FROM vehicle_assignments WHERE is_active
      GROUP BY vehicle_id HAVING count(*) > 1`,
  );
  if (duplicates.rowCount) {
    throw new Error(`Cannot enforce vehicle assignment exclusivity: ${JSON.stringify(duplicates.rows)}`);
  }
  await target.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS vehicle_assignments_active_vehicle_unique
       ON vehicle_assignments(vehicle_id) WHERE is_active`,
  );
}

async function existingForbiddenSourceIds(target: TargetDatabase): Promise<Set<string>> {
  const result = await target.query(
    `SELECT source_id FROM fleetguard_record_mappings
      WHERE source_system=$1 AND status='excluded' AND match_method='forbidden-vehicle-policy'`,
    [FLEETGUARD_SOURCE],
  );
  return new Set(result.rows.map(row => String(row.source_id)));
}

async function sourceTableShapes(sourcePool: pg.Pool): Promise<Record<FleetGuardTable, SourceTableShape>> {
  const result = await sourcePool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [FLEETGUARD_TABLES],
  );
  const columns = new Map<string, Set<string>>();
  for (const row of result.rows) {
    const names = columns.get(row.table_name) ?? new Set<string>();
    names.add(row.column_name);
    columns.set(row.table_name, names);
  }
  return Object.fromEntries(FLEETGUARD_TABLES.map(table => {
    const names = columns.get(table) ?? new Set<string>();
    const cursorColumn = names.has("updated_at") ? "updated_at" : names.has("created_at") ? "created_at" : null;
    const idColumn = names.has("id") ? "id" : "key";
    if (!names.has(idColumn)) throw new Error(`FleetGuard table ${table} has no stable source key`);
    return [table, { cursorColumn, idColumn, columns: names }];
  })) as Record<FleetGuardTable, SourceTableShape>;
}

function sourceProjection(table: FleetGuardTable, columns: Set<string>): string {
  if (table !== "fuel_logs") return "*";
  // Deliberately never transfer station or OCR columns from FleetGuard.
  return [
    "id", "driver_id", "vehicle_id", "date", "litres", "odometer_km",
    "amount_rands", "created_at", "deleted", "deleted_by", "deleted_at",
    "delete_reason", "distance_km", "consumption_l_per_100km", "slip_time",
    "fuel_type", "price_per_litre", "slip_image_data", "slip_image_name",
    "slip_image_mime_type",
  ].filter(column => columns.has(column)).map(column => `"${column}"`).join(",");
}

async function readSourcePage(
  sourcePool: pg.Pool,
  table: FleetGuardTable,
  shape: SourceTableShape,
  startAt: Date | null,
  afterTimestamp: string | null,
  afterId: string | null,
  pageSize = SOURCE_PAGE_SIZE,
): Promise<SourceRow[]> {
  const id = `"${shape.idColumn}"`;
  const projection = sourceProjection(table, shape.columns);
  if (FULL_READ_TABLES.has(table) || !shape.cursorColumn) {
    const values: unknown[] = [pageSize];
    const after = afterId ? `WHERE ${id} > $2` : "";
    if (afterId) values.push(afterId);
    const result = await sourcePool.query(
      `SELECT ${projection} FROM public."${table}" ${after} ORDER BY ${id} ASC LIMIT $1`,
      values,
    );
    return result.rows.map(row => table === "fuel_logs" ? sanitizeFuelLog(row) : stripFuelStationData(row));
  }
  const cursor = `"${shape.cursorColumn}"`;
  const floor = startAt ?? new Date(0);
  const pageCursor = afterTimestamp ?? floor.toISOString();
  const pageId = afterId ?? "";
  const result = await sourcePool.query(
    `SELECT ${projection}, ${cursor}::text AS "__fleetguard_cursor"
       FROM public."${table}"
      WHERE COALESCE(${cursor}, timestamp '1970-01-01') >= $1
        AND (COALESCE(${cursor}, timestamp '1970-01-01'), ${id})
          > (COALESCE($2::timestamp, timestamp '1970-01-01'), $3)
      ORDER BY COALESCE(${cursor}, timestamp '1970-01-01') ASC, ${id} ASC
      LIMIT $4`,
    [floor, pageCursor, pageId, pageSize],
  );
  return result.rows.map(row => {
    const cursorValue = row.__fleetguard_cursor;
    const sanitized = table === "fuel_logs" ? sanitizeFuelLog(row) : stripFuelStationData(row);
    sanitized.__fleetguard_cursor = cursorValue;
    return sanitized;
  });
}

async function existingMappingKeys(target: TargetDatabase): Promise<Set<string>> {
  const result = await target.query(
    `SELECT entity_type, source_id FROM fleetguard_record_mappings WHERE source_system = $1`,
    [FLEETGUARD_SOURCE],
  );
  return new Set(result.rows.map(row => `${row.entity_type}:${row.source_id}`));
}

function asTimestamp(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function entityCreatedAt(row: SourceRow): Date | null {
  return asTimestamp(row.created_at ?? row.createdAt);
}

const nativeCount = (counts: Record<string, ReconciliationCount>, table: string) =>
  (counts[table] ??= emptyCount());

const textValue = (row: SourceRow, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const integerValue = (row: SourceRow, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isInteger(value) && value >= 0 && value <= 10_000_000) return value;
  }
  return null;
};

/**
 * IDs are intentionally source-owned and never collide with JobFlow IDs. Hashing
 * also keeps arbitrary source primary keys out of SQL identifiers and bounded.
 */
export function fleetGuardNativeId(kind: string, sourceId: string): string {
  return `fg-${kind}-${createHash("sha256").update(sourceId).digest("hex").slice(0, 32)}`;
}

export function fleetGuardKmDailyTargetId(vehicleSourceId: string, date: Date | string): string {
  const day = new Date(date).toISOString().slice(0, 10);
  return fleetGuardNativeId("km", `${vehicleSourceId}:${day}`);
}

/** Pure grouping used by the importer and tests; source events stay distinct. */
export function groupFleetGuardKmEvents(rows: SourceRow[]): SourceRow[][] {
  const groups = new Map<string, SourceRow[]>();
  for (const row of rows) {
    const vehicleId = sourceReference(row, "vehicle_id", "vehicleId");
    const date = asTimestamp(row.date);
    if (!vehicleId || !date) continue;
    const key = `${vehicleId}:${date.toISOString().slice(0, 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.values()).map(events => events.slice().sort((a, b) => {
    const at = asTimestamp(a.created_at)?.getTime() ?? asTimestamp(a.date)?.getTime() ?? 0;
    const bt = asTimestamp(b.created_at)?.getTime() ?? asTimestamp(b.date)?.getTime() ?? 0;
    return at - bt || sourceIdForRow("km_logs", a).localeCompare(sourceIdForRow("km_logs", b));
  }));
}

function sourceReference(row: SourceRow, ...keys: string[]): string | null {
  for (const key of keys) {
    if (typeof row[key] === "string" && (row[key] as string).trim()) return row[key] as string;
  }
  return null;
}

type WorkerMatch = { id: string; name: string };

async function loadWorkerMatches(target: TargetDatabase): Promise<WorkerMatch[]> {
  const result = await target.query(`SELECT id, name FROM workers`);
  return result.rows as WorkerMatch[];
}

function uniquelyMatchingWorker(row: SourceRow, workers: WorkerMatch[]): WorkerMatch | null {
  const stableWorkerId = typeof row.id === "string" ? FLEETGUARD_DRIVER_WORKER_IDS[row.id] : null;
  if (stableWorkerId) return workers.find(worker => worker.id === stableWorkerId) ?? null;
  const name = normalizeName(textValue(row, "name", "driver_name", "full_name"));
  if (!name) return null;
  const matches = workers.filter(worker => normalizeName(worker.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

async function upsertMapping(
  target: TargetDatabase, entityType: string, sourceId: string, targetTable: string | null,
  targetId: string | null, status: "mapped" | "quarantined", matchMethod: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await target.query(
    `INSERT INTO fleetguard_record_mappings
      (source_system, entity_type, source_id, target_table, target_id, status, match_method, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (source_system, entity_type, source_id) DO UPDATE SET
       target_table = EXCLUDED.target_table, target_id = EXCLUDED.target_id,
       status = EXCLUDED.status, match_method = EXCLUDED.match_method,
       last_seen_at = now(), metadata_json = fleetguard_record_mappings.metadata_json || EXCLUDED.metadata_json`,
    [FLEETGUARD_SOURCE, entityType, sourceId, targetTable, targetId, status, matchMethod, JSON.stringify(metadata)],
  );
}

async function reconcileCurrentAssignments(
  target: TargetDatabase,
  runId: string,
  sourceDrivers: SourceRow[],
  sourceVehicles: SourceRow[],
): Promise<SourceAssignmentResult[]> {
  const results: SourceAssignmentResult[] = [];
  const vehicleById = new Map(sourceVehicles.map(row => [sourceIdForRow("vehicles", row), row]));
  for (const driver of sourceDrivers) {
    const sourceDriverId = sourceIdForRow("drivers", driver);
    const sourceDriverName = textValue(driver, "name");
    const sourceVehicleId = sourceReference(driver, "vehicle_id", "vehicleId");
    const vehicle = sourceVehicleId ? vehicleById.get(sourceVehicleId) ?? null : null;
    const sourceRegistration = vehicle ? textValue(vehicle, "registration", "registration_number") : null;
    const targetWorkerId = await mappedTargetId(target, "drivers", sourceDriverId);
    const targetVehicleId = sourceVehicleId
      ? await mappedTargetId(target, "vehicles", sourceVehicleId)
      : null;
    const base = {
      sourceDriverId, sourceDriverName, sourceVehicleId, sourceRegistration,
      targetWorkerId, targetVehicleId,
    };
    const conflict = async (error: string): Promise<void> => {
      if (targetWorkerId) {
        await target.query(
          `UPDATE vehicle_assignments SET is_active=false,unassigned_at=now()
            WHERE is_active AND worker_id=ANY($1::text[])
              AND (source_system=$2 OR notes ILIKE '%FleetGuard%')`,
          [equivalentWorkerIds(targetWorkerId), FLEETGUARD_SOURCE],
        );
      }
      await upsertMapping(target, "driver_assignments", sourceDriverId, null, null, "quarantined", "source-assignment-validation", {
        runId, sourceVehicleId, sourceRegistration, error,
      });
      await persistConflict(target, runId, {
        entityType: "driver_assignments",
        sourceId: sourceDriverId,
        reason: error,
        details: stripFuelStationData(base),
      });
      results.push({ ...base, result: "conflicted", error });
    };

    if (!targetWorkerId) {
      await conflict("UNMAPPED_SOURCE_DRIVER");
      continue;
    }
    const aliases = equivalentWorkerIds(targetWorkerId);
    if (!sourceVehicleId) {
      await target.query(
        `UPDATE vehicle_assignments SET is_active=false,unassigned_at=now()
          WHERE worker_id=ANY($1::text[]) AND is_active AND source_system=$2`,
        [aliases, FLEETGUARD_SOURCE],
      );
      results.push({ ...base, result: "unassigned", error: null });
      continue;
    }
    if (!vehicle || !sourceRegistration) {
      await conflict("MISSING_SOURCE_VEHICLE");
      continue;
    }
    if (normalizeRegistration(sourceRegistration) === FORBIDDEN_REGISTRATION) {
      await conflict("FORBIDDEN_VEHICLE");
      continue;
    }
    if (sourceReference(vehicle, "current_driver_id", "currentDriverId") !== sourceDriverId) {
      await conflict("SOURCE_DRIVER_VEHICLE_DISAGREEMENT");
      continue;
    }
    if (!targetVehicleId) {
      await conflict("UNMAPPED_SOURCE_VEHICLE");
      continue;
    }

    const lockKeys = [`fleet-assignment-worker:${aliases.slice().sort()[0]}`, `fleet-assignment-vehicle:${targetVehicleId}`].sort();
    await target.query(
      `SELECT pg_advisory_xact_lock(hashtext($1)), pg_advisory_xact_lock(hashtext($2))`,
      lockKeys,
    );
    const active = await target.query(
      `SELECT id,worker_id,vehicle_id,source_system
         FROM vehicle_assignments
        WHERE is_active AND (worker_id=ANY($1::text[]) OR vehicle_id=$2)`,
      [aliases, targetVehicleId],
    );
    const manualConflict = active.rows.find(row =>
      row.source_system !== FLEETGUARD_SOURCE
      && (row.worker_id !== targetWorkerId || row.vehicle_id !== targetVehicleId));
    if (manualConflict) {
      await conflict("CONFLICTING_MANUAL_ACTIVE_ASSIGNMENT");
      continue;
    }
    await target.query(
      `UPDATE vehicle_assignments SET is_active=false,unassigned_at=now()
        WHERE is_active AND source_system=$1
          AND (worker_id=ANY($2::text[]) OR vehicle_id=$3)
          AND NOT (worker_id=$4 AND vehicle_id=$3)`,
      [FLEETGUARD_SOURCE, aliases, targetVehicleId, targetWorkerId],
    );
    const sourceAssignmentId = `${sourceDriverId}:${sourceVehicleId}`;
    const assignmentId = fleetGuardNativeId("assignment", sourceAssignmentId);
    const exactExisting = active.rows.find(row =>
      aliases.includes(row.worker_id) && row.vehicle_id === targetVehicleId);
    const durableAssignmentId = exactExisting?.id ?? assignmentId;
    if (exactExisting) {
      await target.query(
        `UPDATE vehicle_assignments SET worker_id=$2,source_system=$3,source_assignment_id=$4,
           notes=$5,is_active=true,unassigned_at=null WHERE id=$1`,
        [
          durableAssignmentId, targetWorkerId, FLEETGUARD_SOURCE, sourceAssignmentId,
          JSON.stringify({ source: "FleetGuard", sourceDriverId, sourceVehicleId, runId }),
        ],
      );
    } else await target.query(
      `INSERT INTO vehicle_assignments
        (id,vehicle_id,worker_id,is_active,notes,assigned_at,unassigned_at,source_system,source_assignment_id)
       VALUES ($1,$2,$3,true,$4,$5,null,$6,$7)
       ON CONFLICT (source_system,source_assignment_id) WHERE source_system IS NOT NULL AND source_assignment_id IS NOT NULL
       DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,worker_id=EXCLUDED.worker_id,is_active=true,
         notes=EXCLUDED.notes,unassigned_at=null`,
      [
        assignmentId, targetVehicleId, targetWorkerId,
        JSON.stringify({ source: "FleetGuard", sourceDriverId, sourceVehicleId, runId }),
        new Date(), FLEETGUARD_SOURCE, sourceAssignmentId,
      ],
    );
    await upsertMapping(
      target, "driver_assignments", sourceDriverId, "vehicle_assignments", durableAssignmentId,
      "mapped", "stable-source-driver-and-vehicle-ids",
      { runId, sourceVehicleId, sourceRegistration, sourceAssignmentId },
    );
    results.push({ ...base, result: "mapped", error: null });
  }
  return results;
}

async function mappedTargetId(target: TargetDatabase, entityType: FleetGuardTable, sourceId: string): Promise<string | null> {
  const result = await target.query(
    `SELECT target_id FROM fleetguard_record_mappings
     WHERE source_system = $1 AND entity_type = $2 AND source_id = $3 AND status = 'mapped'`,
    [FLEETGUARD_SOURCE, entityType, sourceId],
  );
  return typeof result.rows[0]?.target_id === "string" ? result.rows[0].target_id : null;
}

async function countNativeUpsert(
  target: TargetDatabase, entityType: FleetGuardTable, sourceId: string, targetTable: string,
  targetId: string, fingerprint: string, count: ReconciliationCount,
): Promise<void> {
  const [mapping, native] = await Promise.all([
    target.query(
      `SELECT target_table, target_id, metadata_json FROM fleetguard_record_mappings
       WHERE source_system = $1 AND entity_type = $2 AND source_id = $3`,
      [FLEETGUARD_SOURCE, entityType, sourceId],
    ),
    target.query(`SELECT 1 FROM ${targetTable} WHERE id = $1`, [targetId]),
  ]);
  const metadata = mapping.rows[0]?.metadata_json as Record<string, unknown> | undefined;
  const sameTarget = mapping.rows[0]?.target_table === targetTable && mapping.rows[0]?.target_id === targetId;
  if (native.rowCount && sameTarget && metadata?.nativeFingerprint === fingerprint) count.unchanged++;
  else if (native.rowCount) count.updated++;
  else count.imported++;
  count.target++;
}

function sourcePhotoUrl(row: SourceRow, ...prefixes: string[]): string | null {
  const direct = textValue(row, "photo_url", "receipt_photo", "receipt_url", "slip_url");
  if (direct) return direct;
  for (const prefix of prefixes) {
    const data = textValue(row, `${prefix}_data`);
    if (data) {
      const mime = textValue(row, `${prefix}_mime`);
      // Do not manufacture a media type for imported evidence. A binary source
      // value without its declared type is not a usable slip/photo reference.
      if (mime) return `data:${mime};base64,${data}`;
    }
  }
  return null;
}

async function uniqueVehicleRegistrationMatch(target: TargetDatabase, registration: string): Promise<{ id: string } | null | "ambiguous"> {
  const result = await target.query(`SELECT id, registration FROM vehicles`);
  const matches = result.rows.filter(row => normalizeRegistration(row.registration) === normalizeRegistration(registration));
  return matches.length === 1 ? { id: matches[0].id } : matches.length > 1 ? "ambiguous" : null;
}

async function persistSourceRow(
  target: TargetDatabase,
  runId: string,
  entityType: FleetGuardTable,
  row: SourceRow,
  action: ReconciliationAction,
): Promise<void> {
  row = entityType === "fuel_logs" ? sanitizeFuelLog(row) : stripFuelStationData(row);
  const createdAt = entityCreatedAt(row) ?? new Date();
  await target.query(
    `INSERT INTO fleetguard_source_records
      (source_system, entity_type, source_id, payload_json, source_created_at, source_deleted)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (source_system, entity_type, source_id) DO UPDATE SET
       payload_json = EXCLUDED.payload_json,
       source_created_at = EXCLUDED.source_created_at,
       source_deleted = EXCLUDED.source_deleted,
       last_seen_at = now()`,
    [
      FLEETGUARD_SOURCE,
      entityType,
      sourceIdForRow(entityType, row),
      JSON.stringify(row),
      createdAt,
      row.deleted === true,
    ],
  );
  await target.query(
    `INSERT INTO fleetguard_record_mappings
      (source_system, entity_type, source_id, status, match_method, source_created_at, metadata_json)
     VALUES ($1, $2, $3, $4, 'raw-source-preservation', $5, $6::jsonb)
     ON CONFLICT (source_system, entity_type, source_id) DO UPDATE SET
       status = EXCLUDED.status,
       source_created_at = EXCLUDED.source_created_at,
       last_seen_at = now(),
        -- Preservation must never discard native target/fingerprint metadata.
        metadata_json = fleetguard_record_mappings.metadata_json || EXCLUDED.metadata_json`,
    [
      FLEETGUARD_SOURCE,
      entityType,
      sourceIdForRow(entityType, row),
      action === "excluded" ? "excluded" : action === "conflicted" ? "quarantined" : "mapped",
      createdAt,
      JSON.stringify({ runId, action, rawOnly: true }),
    ],
  );
}

async function persistExclusion(
  target: TargetDatabase,
  runId: string,
  entityType: FleetGuardTable,
  sourceId: string,
): Promise<void> {
  await target.query(
    `INSERT INTO fleetguard_record_mappings
      (source_system, entity_type, source_id, status, match_method, metadata_json)
     VALUES ($1, $2, $3, 'excluded', 'forbidden-vehicle-policy', $4::jsonb)
     ON CONFLICT (source_system, entity_type, source_id) DO UPDATE SET
       status = 'excluded',
       match_method = 'forbidden-vehicle-policy',
       last_seen_at = now(),
       metadata_json = EXCLUDED.metadata_json`,
    [FLEETGUARD_SOURCE, entityType, sourceId, JSON.stringify({ runId })],
  );
}

async function persistConflict(
  target: TargetDatabase,
  runId: string,
  conflict: ReconciliationConflict,
): Promise<void> {
  const existing = await target.query(
    `SELECT 1 FROM fleetguard_conflicts
     WHERE source_system = $1 AND entity_type = $2 AND source_id = $3 AND reason = $4 AND status = 'open'
     LIMIT 1`,
    [FLEETGUARD_SOURCE, conflict.entityType, conflict.sourceId, conflict.reason],
  );
  if (existing.rowCount) return;
  await target.query(
    `INSERT INTO fleetguard_conflicts
      (import_run_id, source_system, entity_type, source_id, reason, details_json)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      runId,
      FLEETGUARD_SOURCE,
      conflict.entityType,
      conflict.sourceId,
      conflict.reason,
      JSON.stringify(conflict.details),
    ],
  );
}

async function quarantineNativeRow(
  target: TargetDatabase, runId: string, entityType: FleetGuardTable, row: SourceRow,
  nativeCounts: Record<string, ReconciliationCount>, reason: string,
): Promise<void> {
  row = entityType === "fuel_logs" ? sanitizeFuelLog(row) : stripFuelStationData(row);
  const sourceId = sourceIdForRow(entityType, row);
  const count = nativeCount(nativeCounts, entityType);
  count.conflicted++;
  await upsertMapping(target, entityType, sourceId, null, null, "quarantined", "native-validation", { runId, reason });
  await persistConflict(target, runId, {
    entityType, sourceId, reason, details: { row },
  });
}

/**
 * Materialise only records for which every required native relationship can be
 * proven.  This deliberately does not invent workers, merge registrations, or
 * attempt to represent FleetGuard-only template/checklist payloads.
 */
async function materializeNativeRow(
  target: TargetDatabase, runId: string, entityType: FleetGuardTable, row: SourceRow,
  workers: WorkerMatch[], nativeCounts: Record<string, ReconciliationCount>,
): Promise<void> {
  const sourceId = sourceIdForRow(entityType, row);
  const count = nativeCount(nativeCounts, entityType);
  count.source++;
  const nativeEntityTypes: FleetGuardTable[] = [
    "vehicles", "drivers", "km_logs", "fuel_logs", "daily_checks", "inspections",
    "maintenance_records", "service_records",
  ];
  if (!nativeEntityTypes.includes(entityType)) {
    // No JobFlow-native equivalent exists for templates and child payloads.
    count.skipped++;
    return;
  }
  const createdAt = entityCreatedAt(row);
  const mapSuccess = async (table: string, id: string, method: string, fingerprintRow: SourceRow = row) => {
    const fingerprint = nativeSourceFingerprint(fingerprintRow);
    await countNativeUpsert(target, entityType, sourceId, table, id, fingerprint, count);
    await upsertMapping(target, entityType, sourceId, table, id, "mapped", method, {
      runId, sourceEventId: sourceId, sourceCreatedAt: createdAt?.toISOString() ?? null, nativeFingerprint: fingerprint,
    });
  };
  if (entityType === "drivers") {
    const worker = uniquelyMatchingWorker(row, workers);
    if (!worker) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "AMBIGUOUS_OR_MISSING_WORKER_MATCH");
    await upsertMapping(target, entityType, sourceId, "workers", worker.id, "mapped", "unique-normalized-name", {
      runId, sourceEventId: sourceId, workerName: worker.name,
    });
    count.target++; count.unchanged++;
    return;
  }
  if (entityType === "vehicles") {
    const registration = textValue(row, "registration", "registration_number");
    if (!registration) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_REGISTRATION");
    const registrationMatch = await uniqueVehicleRegistrationMatch(target, registration);
    if (registrationMatch === "ambiguous")
      return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "AMBIGUOUS_REGISTRATION_MATCH");
    if (registrationMatch) {
      const fingerprint = nativeSourceFingerprint(row);
      await countNativeUpsert(target, entityType, sourceId, "vehicles", registrationMatch.id, fingerprint, count);
      await upsertMapping(target, entityType, sourceId, "vehicles", registrationMatch.id, "mapped", "unique-normalized-registration", {
        runId, sourceEventId: sourceId, registration, nativeFingerprint: fingerprint,
      });
      return;
    }
    const id = fleetGuardNativeId("vehicle", sourceId);
    const name = textValue(row, "name", "vehicle_name") ?? registration;
    await mapSuccess("vehicles", id, "deterministic-fg-id");
    await target.query(
      `INSERT INTO vehicles (id,name,registration,make,model,year,is_active,vehicle_status,notes,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, registration=EXCLUDED.registration,
         make=EXCLUDED.make, model=EXCLUDED.model, year=EXCLUDED.year, is_active=EXCLUDED.is_active,
         vehicle_status=EXCLUDED.vehicle_status, notes=EXCLUDED.notes`,
      [id, name, registration, textValue(row, "make"), textValue(row, "model"),
        textValue(row, "year"), row.active !== false, textValue(row, "status", "vehicle_status") ?? "active",
         JSON.stringify({ source: "FleetGuard", sourceEventId: sourceId }), createdAt],
    );
    return;
  }
  // Individual source events are materialised as one native daily row after
  // the full km_logs table has been read.
  if (entityType === "km_logs") return;
  const vehicleSourceId = sourceReference(row, "vehicle_id", "vehicleId");
  const vehicleId = vehicleSourceId ? await mappedTargetId(target, "vehicles", vehicleSourceId) : null;
  if (!vehicleId) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "UNMAPPED_VEHICLE");
  const driverSourceId = sourceReference(row, "driver_id", "driverId", "worker_id", "workerId");
  const workerId = driverSourceId
    ? await mappedTargetId(target, "drivers", driverSourceId)
    : entityType === "inspections"
      ? uniquelyMatchingWorker({ name: textValue(row, "inspector_name") }, workers)?.id ?? null
      : null;
  const needsWorker = ["km_logs", "fuel_logs", "daily_checks", "inspections"].includes(entityType);
  if (needsWorker && !workerId) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "UNMAPPED_DRIVER");

  if (entityType === "fuel_logs") {
    const date = asTimestamp(row.date ?? row.fill_date ?? row.created_at);
    const litres = Number(row.litres ?? row.liters ?? row.quantity);
    const cost = Number(row.amount_rands ?? row.cost ?? row.amount ?? row.total_cost);
    const odometer = integerValue(row, "odometer_km", "odometer", "mileage");
    const fuelType = textValue(row, "fuel_type", "fuelType");
    const receiptPhoto = sourcePhotoUrl(row, "slip", "receipt", "photo");
    if (!date) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_FUEL_DATE");
    if (odometer === null || odometer <= 0)
      return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_OR_INVALID_FUEL_ODOMETER");
    if (!Number.isFinite(litres) || litres <= 0)
      return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_OR_INVALID_FUEL_LITRES");
    if (!Number.isFinite(cost) || cost <= 0)
      return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_OR_INVALID_FUEL_COST");
    if (!fuelType) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_FUEL_TYPE");
    if (!receiptPhoto) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "MISSING_FUEL_SLIP_OR_PHOTO");
    const sanitizedFuel = sanitizeFuelLog(row);
    const fuelCreatedAt = entityCreatedAt(row) ?? date;
    const id = fleetGuardNativeId("fuel", sourceId);
    await mapSuccess("fuel_fillups", id, "deterministic-fg-fuel-id", sanitizedFuel);
    await target.query(
      `INSERT INTO fuel_fillups (id,vehicle_id,worker_id,fill_date,odometer,litres,cost,fuel_type,receipt_photo,notes,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,worker_id=EXCLUDED.worker_id,fill_date=EXCLUDED.fill_date,
          odometer=EXCLUDED.odometer,litres=EXCLUDED.litres,cost=EXCLUDED.cost,fuel_type=EXCLUDED.fuel_type,
          receipt_photo=EXCLUDED.receipt_photo,notes=EXCLUDED.notes`,
       [id, vehicleId, workerId, date, odometer, litres, cost, fuelType, receiptPhoto,
         JSON.stringify({ source: "FleetGuard", sourceEventId: sourceId }), fuelCreatedAt],
    );
    return;
  }
  if (entityType === "daily_checks" || entityType === "inspections") {
    const date = asTimestamp(row.inspection_date ?? row.check_date ?? row.date ?? row.created_at);
    if (!date) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "INVALID_INSPECTION_DATE");
    const id = fleetGuardNativeId(entityType === "daily_checks" ? "check" : "inspection", sourceId);
    await mapSuccess("vehicle_inspections", id, "deterministic-fg-id");
    await target.query(
      `INSERT INTO vehicle_inspections (id,vehicle_id,worker_id,inspection_date,overall_result,items_json,comments,photo_url,fail_alert_sent,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9)
       ON CONFLICT (id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,worker_id=EXCLUDED.worker_id,inspection_date=EXCLUDED.inspection_date,
        overall_result=EXCLUDED.overall_result,items_json=EXCLUDED.items_json,comments=EXCLUDED.comments,photo_url=EXCLUDED.photo_url`,
      [id, vehicleId, workerId, date, textValue(row, "overall_result", "result", "status") ?? "pass",
        JSON.stringify(row.items ?? row.checklist_items ?? {
          result: row.result, problemCategory: row.problem_category, vehicleSafe: row.vehicle_safe,
          maintenanceRequired: row.maintenance_required,
        }), textValue(row, "problem_comment", "comments", "notes"),
        sourcePhotoUrl(row, "photo"), createdAt],
    );
    return;
  }
  if (entityType === "maintenance_records" || entityType === "service_records") {
    const date = asTimestamp(row.service_date ?? row.date ?? row.created_at);
    const odometer = integerValue(row, "odometer_km", "odometer", "mileage");
    const work = textValue(row, "work_completed", "work_done", "description", "service_description");
    if (!date || odometer === null || !work) return quarantineNativeRow(target, runId, entityType, row, nativeCounts, "INVALID_SERVICE_RECORD");
    const id = fleetGuardNativeId("service", sourceId);
    await mapSuccess("service_records", id, "deterministic-fg-id");
    await target.query(
      `INSERT INTO service_records (id,vehicle_id,service_date,odometer,service_provider,work_done,issues_fixed,cost,invoice_number,notes,next_service_date,next_service_odometer,created_by_worker_id,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,service_date=EXCLUDED.service_date,odometer=EXCLUDED.odometer,
        service_provider=EXCLUDED.service_provider,work_done=EXCLUDED.work_done,issues_fixed=EXCLUDED.issues_fixed,cost=EXCLUDED.cost,notes=EXCLUDED.notes,
        next_service_date=EXCLUDED.next_service_date,next_service_odometer=EXCLUDED.next_service_odometer`,
      [id, vehicleId, date, odometer, textValue(row, "provider", "service_provider") ?? "FleetGuard import", work,
        textValue(row, "issues_fixed"), Number.isFinite(Number(row.cost)) ? Number(row.cost) : null,
        textValue(row, "invoice_number"), JSON.stringify({ source: "FleetGuard", sourceEventId: sourceId, status: row.status, photo: sourcePhotoUrl(row, "photo") }),
        asTimestamp(row.next_service_date), integerValue(row, "next_service_odometer_km", "next_service_odometer"), workerId, createdAt],
    );
    return;
  }
  // FleetGuard-only child payloads remain preserved in fleetguard_source_records.
  count.skipped++;
}

async function materializeKmGroups(
  target: TargetDatabase, runId: string, rows: SourceRow[],
  source: Partial<Record<FleetGuardTable, SourceRow[]>>, nativeCounts: Record<string, ReconciliationCount>,
): Promise<void> {
  const forbiddenVehicles = sourceVehicleIds(source.vehicles ?? []);
  const groups = new Map<string, SourceRow[]>();
  for (const row of rows) {
    const count = nativeCount(nativeCounts, "km_logs");
    count.source++;
    if (isExcludedSourceRow(source, "km_logs", row, forbiddenVehicles)) {
      count.excluded++;
      continue;
    }
    const vehicleSourceId = sourceReference(row, "vehicle_id", "vehicleId");
    const date = asTimestamp(row.date);
    const type = textValue(row, "log_type")?.toUpperCase();
    const odometer = integerValue(row, "odometer_km");
    if (!vehicleSourceId || !date || !["AM", "PM"].includes(type ?? "") || odometer === null) {
      await quarantineNativeRow(target, runId, "km_logs", row, nativeCounts, "INVALID_KM_EVENT");
      continue;
    }
    const key = `${vehicleSourceId}:${date.toISOString().slice(0, 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const events of Array.from(groups.values())) {
    const first = events[0];
    const vehicleSourceId = sourceReference(first, "vehicle_id", "vehicleId")!;
    const vehicleId = await mappedTargetId(target, "vehicles", vehicleSourceId);
    const driverIds = Array.from(new Set<string>(
      events
        .map((event: SourceRow) => sourceReference(event, "driver_id", "driverId"))
        .filter((id): id is string => id !== null),
    ));
    const mappedWorkers = await Promise.all(driverIds.map(id => mappedTargetId(target, "drivers", id)));
    if (!vehicleId || driverIds.length !== 1 || !mappedWorkers[0]) {
      for (const event of events) await quarantineNativeRow(target, runId, "km_logs", event, nativeCounts,
        !vehicleId ? "UNMAPPED_VEHICLE" : "AMBIGUOUS_OR_UNMAPPED_KM_DRIVER");
      continue;
    }
    const ordered = [...events].sort((a, b) => {
      const at = asTimestamp(a.created_at)?.getTime() ?? asTimestamp(a.date)?.getTime() ?? 0;
      const bt = asTimestamp(b.created_at)?.getTime() ?? asTimestamp(b.date)?.getTime() ?? 0;
      return at - bt || sourceIdForRow("km_logs", a).localeCompare(sourceIdForRow("km_logs", b));
    });
    const eventSnapshots = ordered.map(event => ({
      type: textValue(event, "log_type")!.toUpperCase(),
      odometer: integerValue(event, "odometer_km")!,
      // created_at is the actual event order/time; date is retained as fallback.
      timestamp: (asTimestamp(event.created_at) ?? asTimestamp(event.date)!).toISOString(),
      sourceEventId: sourceIdForRow("km_logs", event),
      note: textValue(event, "note"),
    }));
    const am = eventSnapshots.find(event => event.type === "AM") ?? eventSnapshots[0];
    const pm = [...eventSnapshots].reverse().find(event => event.type === "PM") ?? eventSnapshots.at(-1)!;
    const logDate = asTimestamp(first.date)!;
    const id = fleetGuardKmDailyTargetId(vehicleSourceId, logDate);
    const count = nativeCount(nativeCounts, "km_logs");
    const fingerprint = nativeSourceFingerprint({ vehicleSourceId, day: logDate.toISOString().slice(0, 10), snapshots: eventSnapshots });
    await countNativeUpsert(target, "km_logs", sourceIdForRow("km_logs", first), "km_logs", id, fingerprint, count);
    await target.query(
      `INSERT INTO km_logs (id,vehicle_id,worker_id,log_date,start_odometer,end_odometer,total_km,business_km,private_km,notes,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,$8,$9)
       ON CONFLICT (id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,worker_id=EXCLUDED.worker_id,log_date=EXCLUDED.log_date,
        start_odometer=EXCLUDED.start_odometer,end_odometer=EXCLUDED.end_odometer,total_km=EXCLUDED.total_km,notes=EXCLUDED.notes`,
      [id, vehicleId, mappedWorkers[0], logDate, am.odometer, pm.odometer, Math.max(0, pm.odometer - am.odometer),
        JSON.stringify({ source: "FleetGuard", snapshots: eventSnapshots }), entityCreatedAt(first) ?? new Date()],
    );
    for (const event of events) {
      await upsertMapping(target, "km_logs", sourceIdForRow("km_logs", event), "km_logs", id, "mapped", "vehicle-date-am-pm-group", {
        runId, sourceEventId: sourceIdForRow("km_logs", event), sourceEventIds: eventSnapshots.map(snapshot => snapshot.sourceEventId),
        nativeFingerprint: fingerprint,
      });
    }
  }
}

export type RunOptions = {
  apply?: boolean;
  targetDatabaseUrl?: string;
};

/**
 * Runs a full source snapshot. Dry-run is the default. Apply requires an
 * explicit target connection and writes only JobFlow reconciliation/native fleet
 * tables; FleetGuard is always connected read-only.
 * FleetGuard is always connected read-only.
 */
export async function runFleetGuardReconciliation(
  options: RunOptions = {},
): Promise<ReconciliationReport> {
  const mode = options.apply ? "apply" : "dry-run";
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const sourcePool = createPool(process.env.FLEETGUARD_DATABASE_URL ?? "", true);
  const targetPool = options.apply
    ? createPool(options.targetDatabaseUrl ?? process.env.FLEETGUARD_TARGET_DATABASE_URL ?? process.env.DATABASE_URL ?? "", false)
    : null;
  const report: ReconciliationReport = {
    runId,
    mode,
    startedAt,
    counts: {},
    nativeCounts: {},
    conflicts: [],
    samples: [],
    timings: {},
  };

  try {
    const shapes = await sourceTableShapes(sourcePool);
    if (targetPool) {
      await ensureReconciliationTables(targetPool);
      await ensureAssignmentExclusivity(targetPool);
      await targetPool.query(
        `UPDATE fleetguard_import_runs SET status='failed',completed_at=now(),
           error=COALESCE(error,'Superseded by a later resumable reconciliation run')
         WHERE source_system=$1 AND status='running' AND id<>$2`,
        [FLEETGUARD_SOURCE, runId],
      );
      await targetPool.query(
        `INSERT INTO fleetguard_import_runs (id, source_system, mode, status, started_at)
         VALUES ($1, $2, $3, 'running', $4)`,
        [runId, FLEETGUARD_SOURCE, mode, startedAt],
      );
    }
    const mappings = targetPool ? await existingMappingKeys(targetPool) : new Set<string>();
    const workers = targetPool ? await loadWorkerMatches(targetPool) : [];
    const forbiddenIds = targetPool ? await existingForbiddenSourceIds(targetPool) : new Set<string>();
    const kmRows: SourceRow[] = [];
    const assignmentSource: Partial<Record<"vehicles" | "drivers", SourceRow[]>> = {};

    for (const table of FLEETGUARD_TABLES) {
      const tableStarted = Date.now();
      const count = (report.counts[table] ??= emptyCount());
      const shape = shapes[table];
      let watermark: Date | null = null;
      if (targetPool && !FULL_READ_TABLES.has(table) && shape.cursorColumn) {
        const mark = await targetPool.query(
          `SELECT source_created_at FROM fleetguard_high_water_marks
           WHERE source_system = $1 AND entity_type = $2`,
          [FLEETGUARD_SOURCE, table],
        );
        watermark = asTimestamp(mark.rows[0]?.source_created_at);
      }
      const startAt = sourceLookbackStart(watermark);
      let afterTimestamp: string | null = null;
      let afterId: string | null = null;
      let pageNumber = 0;
      let tableRows = 0;

      while (true) {
        const pageStarted = Date.now();
        const rows = await readSourcePage(
          sourcePool, table, shape, startAt, afterTimestamp, afterId,
        );
        if (!rows.length) break;
        pageNumber++;
        const last = rows.at(-1)!;
        const nextCursorTimestamp = shape.cursorColumn
          ? String(last.__fleetguard_cursor ?? "1970-01-01 00:00:00")
          : null;
        const nextTimestamp = nextCursorTimestamp ? asTimestamp(nextCursorTimestamp) ?? new Date(0) : null;
        const nextId = String(last[shape.idColumn] ?? "");
        if (nextCursorTimestamp === afterTimestamp && nextId === afterId) {
          throw new Error(`FleetGuard pagination made no progress for ${table} at ${nextCursorTimestamp}/${nextId}`);
        }
        for (const row of rows) delete row.__fleetguard_cursor;
        if (table === "vehicles" || table === "drivers") {
          assignmentSource[table] = [...(assignmentSource[table] ?? []), ...rows];
        }

        if (targetPool) {
          const targetClient = await targetPool.connect();
          await targetClient.query("BEGIN");
          try {
            await targetClient.query(
              `INSERT INTO fleetguard_import_checkpoints
                (source_system, entity_type, import_run_id, status, page_number)
               VALUES ($1,$2,$3,'running',$4)
               ON CONFLICT (source_system, entity_type) DO UPDATE SET
                 import_run_id=EXCLUDED.import_run_id,status='running',
                 page_number=EXCLUDED.page_number,error=NULL,updated_at=now()`,
              [FLEETGUARD_SOURCE, table, runId, pageNumber],
            );
            for (const row of rows) {
              const sourceId = sourceIdForRow(table, row);
              const excluded = table === "vehicles"
                ? normalizeRegistration(row.registration) === FORBIDDEN_REGISTRATION
                : Object.entries(row).some(([key, value]) =>
                    (key.endsWith("_id") || key.endsWith("Id"))
                    && typeof value === "string" && forbiddenIds.has(value));
              if (excluded) forbiddenIds.add(sourceId);
              const conflicted = table === "vehicles"
                && !textValue(row, "registration", "registration_number");
              const mappingKey = `${table}:${sourceId}`;
              const action: ReconciliationAction = excluded
                ? "excluded"
                : conflicted
                  ? "conflicted"
                  : mappings.has(mappingKey) ? "unchanged" : "imported";
              count.source++;
              count[action]++;
              if (excluded) {
                await persistExclusion(targetClient, runId, table, sourceId);
              } else {
                await persistSourceRow(targetClient, runId, table, row, action);
                if (!conflicted && table !== "km_logs") {
                  await materializeNativeRow(targetClient, runId, table, row, workers, report.nativeCounts);
                }
              }
              mappings.add(mappingKey);
              if (table === "km_logs" && !excluded) kmRows.push(row);
              if (report.samples.length < 25) report.samples.push({ entityType: table, sourceId, action });
            }
            tableRows += rows.length;
            count.target = count.imported + count.updated + count.unchanged;
            await targetClient.query(
              `INSERT INTO fleetguard_high_water_marks
                (source_system, entity_type, source_created_at, source_id)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (source_system, entity_type) DO UPDATE SET
                 source_created_at=CASE
                   WHEN EXCLUDED.source_created_at IS NULL THEN fleetguard_high_water_marks.source_created_at
                   ELSE GREATEST(fleetguard_high_water_marks.source_created_at, EXCLUDED.source_created_at)
                 END,
                 source_id=CASE
                   WHEN fleetguard_high_water_marks.source_created_at IS NULL
                     OR EXCLUDED.source_created_at >= fleetguard_high_water_marks.source_created_at
                   THEN EXCLUDED.source_id ELSE fleetguard_high_water_marks.source_id END,
                 updated_at=now()`,
              [FLEETGUARD_SOURCE, table, nextTimestamp, nextId],
            );
            await targetClient.query(
              `UPDATE fleetguard_import_checkpoints SET
                 status=$4,page_number=$5,cursor_timestamp=$6,cursor_source_id=$7,
                 rows_committed=$8,counts_json=$9::jsonb,error=NULL,updated_at=now()
               WHERE source_system=$1 AND entity_type=$2 AND import_run_id=$3`,
              [
                FLEETGUARD_SOURCE, table, runId,
                rows.length < SOURCE_PAGE_SIZE ? "completed" : "running",
                pageNumber, nextTimestamp, nextId, tableRows, JSON.stringify(count),
              ],
            );
            await targetClient.query("COMMIT");
          } catch (error) {
            await targetClient.query("ROLLBACK");
            await targetPool.query(
              `UPDATE fleetguard_import_checkpoints
                  SET status='failed',error=$4,updated_at=now()
                WHERE source_system=$1 AND entity_type=$2 AND import_run_id=$3`,
              [FLEETGUARD_SOURCE, table, runId, error instanceof Error ? error.message : String(error)],
            );
            throw error;
          } finally {
            targetClient.release();
          }
        } else {
          count.source += rows.length;
          tableRows += rows.length;
        }
        console.error(JSON.stringify({
          event: "fleetguard_source_page", runId, table, page: pageNumber,
          rows: rows.length, milliseconds: Date.now() - pageStarted,
        }));
        afterTimestamp = nextCursorTimestamp;
        afterId = nextId;
        if (rows.length < SOURCE_PAGE_SIZE) break;
      }
      report.timings![table] = {
        pages: pageNumber,
        milliseconds: Date.now() - tableStarted,
        rows: tableRows,
      };
      if (targetPool) {
        await targetPool.query(
          `UPDATE fleetguard_import_checkpoints
              SET status='completed',error=NULL,updated_at=now()
            WHERE source_system=$1 AND entity_type=$2 AND import_run_id=$3`,
          [FLEETGUARD_SOURCE, table, runId],
        );
      }
      console.error(JSON.stringify({ event: "fleetguard_table_complete", runId, table, ...report.timings![table] }));
    }

    if (targetPool && kmRows.length) {
      const targetClient = await targetPool.connect();
      await targetClient.query("BEGIN");
      try {
        await materializeKmGroups(targetClient, runId, kmRows, { vehicles: [] }, report.nativeCounts);
        await targetClient.query("COMMIT");
      } catch (error) {
        await targetClient.query("ROLLBACK");
        throw error;
      } finally {
        targetClient.release();
      }
    }
    if (targetPool) {
      const targetClient = await targetPool.connect();
      await targetClient.query("BEGIN");
      try {
        report.assignments = await reconcileCurrentAssignments(
          targetClient,
          runId,
          assignmentSource.drivers ?? [],
          assignmentSource.vehicles ?? [],
        );
        await targetClient.query("COMMIT");
      } catch (error) {
        await targetClient.query("ROLLBACK");
        throw error;
      } finally {
        targetClient.release();
      }
    }
    report.completedAt = new Date().toISOString();
    if (targetPool) {
      await targetPool.query(
        `UPDATE fleetguard_import_runs
            SET status='completed',completed_at=$2,source_snapshot_at=$2,counts_json=$3::jsonb,error=NULL
          WHERE id=$1`,
        [runId, report.completedAt, JSON.stringify({
          preservationCounts: report.counts,
          nativeCounts: report.nativeCounts,
          timings: report.timings,
          assignments: report.assignments,
        })],
      );
    }
    return report;
  } catch (error) {
    if (targetPool) {
      await targetPool.query(
        `UPDATE fleetguard_import_runs
            SET status='failed',completed_at=now(),error=$2,counts_json=$3::jsonb
          WHERE id=$1`,
        [runId, error instanceof Error ? error.message : String(error), JSON.stringify({
          preservationCounts: report.counts,
          nativeCounts: report.nativeCounts,
          timings: report.timings,
        })],
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    await sourcePool.end();
    if (targetPool) await targetPool.end();
  }
}

function printReport(report: ReconciliationReport): void {
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("fleetguard-reconciliation.ts")) {
  const apply = process.argv.includes("--apply");
  runFleetGuardReconciliation({ apply })
    .then(printReport)
    .catch(error => {
      console.error("[fleetguard-reconciliation] failed:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}