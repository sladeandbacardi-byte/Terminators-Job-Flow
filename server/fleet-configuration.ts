import { pool } from "./db";
import { FLEET_INSPECTION_CHECKS } from "@shared/fleet";

type TemplateItem = { id: string; label: string; position: number; templateId?: string };
type InspectionTemplate = { id: string; name: string; version: number; items: TemplateItem[]; [key: string]: unknown };

const canonicalTemplate = (type: "daily" | "monthly"): InspectionTemplate & { templateId: string; source: "canonical-fallback" } => {
  const templateId = `canonical-${type}-v1`;
  return {
    id: templateId, templateId, name: `Canonical ${type} inspection`, version: 1, source: "canonical-fallback",
    items: FLEET_INSPECTION_CHECKS.map((label, position) => ({ id: `canonical-${position}`, label, position, templateId })),
  };
};

/** Pure DTO builder shared by overview code and contract tests. */
export function buildMobileInspectionConfiguration(templates: InspectionTemplate[]) {
  const ordered = templates.slice().sort((a, b) =>
    a.name.localeCompare(b.name) || b.version - a.version || a.id.localeCompare(b.id));
  const database = (template: InspectionTemplate) => ({
    ...template, templateId: template.id, source: "database" as const,
    items: template.items.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map(item => ({ id: item.id, label: item.label, position: item.position, templateId: template.id })),
  });
  const daily = ordered.filter(template => !template.name.toLowerCase().includes("month")).map(database);
  const monthly = ordered.filter(template => template.name.toLowerCase().includes("month")).map(database);
  const dailyTemplates = daily.length ? daily : [canonicalTemplate("daily")];
  const monthlyTemplates = monthly.length ? monthly : [canonicalTemplate("monthly")];
  return {
    inspectionTemplates: [...dailyTemplates, ...monthlyTemplates],
    dailyInspectionTemplates: dailyTemplates,
    monthlyInspectionTemplates: monthlyTemplates,
    dailyInspectionTemplateId: dailyTemplates[0].templateId,
    monthlyInspectionTemplateId: monthlyTemplates[0].templateId,
    dailyInspectionItems: dailyTemplates[0].items,
    monthlyInspectionItems: monthlyTemplates[0].items,
  };
}

export function validateInspectionItemsForTemplate(
  templateId: string, activeItems: TemplateItem[],
  submitted: unknown,
): Array<{ name: string; result: "pass" | "fail"; comments?: unknown }> {
  if (!Array.isArray(submitted)) throw new Error("Complete every vehicle safety check before submitting.");
  const expected = activeItems.slice().sort((a, b) => a.position - b.position);
  if (submitted.length !== expected.length) throw new Error("Complete every vehicle safety check before submitting.");
  return submitted.map((item: any, index) => {
    if (!item || item.name !== expected[index].label || !["pass", "fail"].includes(item.result)) {
      throw new Error("Inspection answers must match the selected active template.");
    }
    return { name: item.name, result: item.result, ...(item.comments !== undefined ? { comments: item.comments } : {}) };
  });
}

export async function listFleetSettings() {
  return (await pool.query(`SELECT * FROM fleet_settings_versions ORDER BY version DESC`)).rows;
}
export async function createFleetSettings(settings: unknown, actorId: string) {
  const result = await pool.query(
    `INSERT INTO fleet_settings_versions(version,settings_json,created_by)
     SELECT COALESCE(MAX(version),0)+1,$1::jsonb,$2 FROM fleet_settings_versions RETURNING *`,
    [JSON.stringify(settings), actorId],
  );
  return result.rows[0];
}
export async function listInspectionTemplates(includeArchived = false) {
  const templates = await pool.query(`SELECT * FROM fleet_inspection_templates ${includeArchived ? "" : "WHERE archived_at IS NULL"} ORDER BY name`);
  const items = await pool.query(`SELECT * FROM fleet_inspection_template_items ${includeArchived ? "" : "WHERE archived_at IS NULL"} ORDER BY template_id,position`);
  return templates.rows.map(template => ({ ...template, items: items.rows.filter(item => item.template_id === template.id) }));
}
export async function assertInspectionTemplateAvailable(templateId: string) {
  if (/^canonical-(daily|monthly)-v1$/.test(templateId)) return;
  const result = await pool.query(`SELECT 1 FROM fleet_inspection_templates WHERE id=$1 AND archived_at IS NULL`, [templateId]);
  if (!result.rowCount) throw new Error("Inspection template is unavailable.");
}
export async function mobileInspectionConfiguration() {
  const templates = await listInspectionTemplates(false);
  return buildMobileInspectionConfiguration(templates as InspectionTemplate[]);
}

export async function prepareInspectionSubmission(templateId: string, submitted: unknown) {
  let template: InspectionTemplate;
  if (/^canonical-(daily|monthly)-v1$/.test(templateId)) {
    template = canonicalTemplate(templateId.includes("monthly") ? "monthly" : "daily");
  } else {
    const found = (await listInspectionTemplates(false)).find(item => item.id === templateId);
    if (!found) throw new Error("Inspection template is unavailable.");
    template = { ...found, items: found.items } as InspectionTemplate;
  }
  const items = validateInspectionItemsForTemplate(templateId, template.items, submitted);
  const inspectionType: "daily" | "monthly" =
    template.id === "canonical-monthly-v1" || template.name.toLowerCase().includes("month") ? "monthly" : "daily";
  const snapshot = {
    id: template.id, templateId: template.id, name: template.name, version: template.version,
    source: template.id.startsWith("canonical-") ? "canonical-fallback" : "database",
    items: template.items.slice().sort((a, b) => a.position - b.position)
      .map(item => ({ id: item.id, label: item.label, position: item.position, templateId: template.id })),
  };
  return { items, snapshot, inspectionType };
}

export async function writeInspectionSnapshot(inspectionId: string, snapshot: unknown) {
  await pool.query(`UPDATE vehicle_inspections SET template_snapshot_json=$2::jsonb WHERE id=$1`, [inspectionId, JSON.stringify(snapshot)]);
}
export async function createInspectionTemplate(name: string, items: string[], actorId: string) {
  if (!name.trim() || !Array.isArray(items) || !items.length || items.some(item => typeof item !== "string" || !item.trim())) throw new Error("A template name and at least one item are required.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const template = (await client.query(
      `INSERT INTO fleet_inspection_templates(name,created_by) VALUES($1,$2) RETURNING *`, [name.trim(), actorId],
    )).rows[0];
    for (let position = 0; position < items.length; position += 1) {
      const label = items[position];
      await client.query(`INSERT INTO fleet_inspection_template_items(template_id,label,position) VALUES($1,$2,$3)`, [template.id, label.trim(), position]);
    }
    await client.query("COMMIT");
    return template;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
export async function archiveInspectionTemplate(id: string, actorId: string, archived: boolean) {
  const result = await pool.query(
    `UPDATE fleet_inspection_templates SET archived_at=${archived ? "now()" : "NULL"},version=version+1 WHERE id=$1 RETURNING *`, [id],
  );
  if (!result.rowCount) throw new Error("Inspection template not found.");
  await pool.query(`INSERT INTO fleet_audit_entries(entity_type,entity_id,action,actor_id,reason,after_json) VALUES('inspection-template',$1,$2,$3,$4,$5::jsonb)`,
    [id, archived ? "archive" : "restore", actorId, archived ? "Template archived" : "Template restored", JSON.stringify(result.rows[0])]);
  return result.rows[0];
}
export async function updateInspectionTemplateItem(
  templateId: string, itemId: string, values: { label?: unknown; position?: unknown; archived?: unknown }, actorId: string,
) {
  const label = values.label === undefined ? undefined : String(values.label).trim();
  const position = values.position === undefined ? undefined : Number(values.position);
  if (label !== undefined && !label) throw new Error("Item label is required.");
  if (position !== undefined && (!Number.isInteger(position) || position < 0)) throw new Error("Item position is invalid.");
  const changes: string[] = []; const args: unknown[] = [itemId, templateId];
  if (label !== undefined) { args.push(label); changes.push(`label=$${args.length}`); }
  if (position !== undefined) { args.push(position); changes.push(`position=$${args.length}`); }
  if (typeof values.archived === "boolean") changes.push(`archived_at=${values.archived ? "now()" : "NULL"}`);
  if (!changes.length) throw new Error("No item change supplied.");
  const result = await pool.query(`UPDATE fleet_inspection_template_items SET ${changes.join(",")} WHERE id=$1 AND template_id=$2 RETURNING *`, args);
  if (!result.rowCount) throw new Error("Inspection template item not found.");
  await pool.query(`UPDATE fleet_inspection_templates SET version=version+1 WHERE id=$1`, [templateId]);
  await pool.query(`INSERT INTO fleet_audit_entries(entity_type,entity_id,action,actor_id,reason,after_json) VALUES('inspection-template-item',$1,'update',$2,'Template item updated',$3::jsonb)`, [itemId, actorId, JSON.stringify(result.rows[0])]);
  return result.rows[0];
}
/** Copies the exact template and items used; future reordering/editing cannot rewrite evidence. */
export async function snapshotInspectionTemplate(inspectionId: string, templateId: string) {
  if (/^canonical-(daily|monthly)-v1$/.test(templateId)) {
    const type = templateId.includes("monthly") ? "monthly" : "daily";
    const snapshot = {
      id: templateId, name: `Canonical ${type} inspection`, version: 1, source: "canonical-fallback",
      items: FLEET_INSPECTION_CHECKS.map((label, position) => ({ id: `canonical-${position}`, label, position })),
    };
    await pool.query(`UPDATE vehicle_inspections SET template_snapshot_json=$2::jsonb WHERE id=$1`, [inspectionId, JSON.stringify(snapshot)]);
    return snapshot;
  }
  const template = (await pool.query(`SELECT * FROM fleet_inspection_templates WHERE id=$1 AND archived_at IS NULL`, [templateId])).rows[0];
  if (!template) throw new Error("Inspection template is unavailable.");
  const items = (await pool.query(`SELECT id,label,position FROM fleet_inspection_template_items WHERE template_id=$1 AND archived_at IS NULL ORDER BY position`, [templateId])).rows;
  const snapshot = { id: template.id, name: template.name, version: template.version, items };
  await pool.query(`UPDATE vehicle_inspections SET template_snapshot_json=$2::jsonb WHERE id=$1`, [inspectionId, JSON.stringify(snapshot)]);
  return snapshot;
}