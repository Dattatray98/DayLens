import { Capacitor } from "@capacitor/core";
import { initDatabase, persistDatabaseChanges } from "../../database/configDatabase";
import {
  NUTRIENTS,
  totalDailyNutrition,
  type DailyNutritionTotals,
  type FoodReferenceBasis,
  type FoodUnit,
  type Nutrient,
  type NutritionValues,
} from "./nutritionCalculations";

export interface DietFood extends NutritionValues {
  id: number;
  name: string;
  referenceBasis: FoodReferenceBasis;
  servingSize: number;
  servingUnit: FoodUnit;
  createdAt: string;
  updatedAt: string;
}

export interface DietFoodInput extends NutritionValues {
  name: string;
  referenceBasis: FoodReferenceBasis;
  servingSize: number;
  servingUnit: FoodUnit;
}

export interface DietEntry extends NutritionValues {
  id: number;
  source: "diet" | "legacy";
  foodId: number | null;
  foodName: string;
  quantity: number;
  unit: FoodUnit | string;
  timestamp: string;
  notes: string | null;
}

export interface DietEntryInput extends NutritionValues {
  foodId: number | null;
  foodName: string;
  quantity: number;
  unit: FoodUnit;
  timestamp: string;
  notes: string | null;
}

export interface DietTargets {
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
}

export interface DietDayData {
  date: string;
  entries: DietEntry[];
  entryCount: number;
  totals: DailyNutritionTotals;
  targets: DietTargets;
  recentEntries: DietEntry[];
}

const units = new Set<FoodUnit>(["g", "ml", "piece", "serving"]);
const bases = new Set<FoodReferenceBasis>(["per_100g", "per_100ml", "per_serving"]);
const targetDefinitions: Record<Nutrient, { name: string; unit: string }> = {
  calories: { name: "Diet calories", unit: "kcal" },
  protein: { name: "Diet protein", unit: "g" },
  carbohydrates: { name: "Diet carbohydrates", unit: "g" },
  fat: { name: "Diet fat", unit: "g" },
};
const targetCategory = "nutrition";

const nullableNumber = (value: unknown) => value == null ? null : Number(value);

const mapFood = (row: Record<string, unknown>): DietFood => ({
  id: Number(row.id),
  name: String(row.name),
  referenceBasis: String(row.reference_basis) as FoodReferenceBasis,
  servingSize: Number(row.serving_size),
  servingUnit: String(row.serving_unit) as FoodUnit,
  calories: nullableNumber(row.calories),
  protein: nullableNumber(row.protein),
  carbohydrates: nullableNumber(row.carbohydrates),
  fat: nullableNumber(row.fat),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const mapEntry = (row: Record<string, unknown>, source: DietEntry["source"]): DietEntry => ({
  id: Number(row.id),
  source,
  foodId: nullableNumber(row.food_id),
  foodName: String(row.food_name ?? row.food),
  quantity: Number(row.quantity),
  unit: String(row.unit),
  calories: nullableNumber(row.calories),
  protein: nullableNumber(row.protein),
  carbohydrates: nullableNumber(row.carbohydrates),
  fat: nullableNumber(row.fat),
  timestamp: String(row.timestamp),
  notes: row.notes == null ? null : String(row.notes),
});

const persist = async () => {
  if (Capacitor.getPlatform() === "web") await persistDatabaseChanges();
};

const validateNutrients = (values: NutritionValues) => {
  for (const nutrient of NUTRIENTS) {
    const value = values[nutrient];
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${nutrientLabel(nutrient)} must be a non-negative number or left blank.`);
    }
  }
};

const nutrientLabel = (nutrient: Nutrient) => ({
  calories: "Calories",
  protein: "Protein",
  carbohydrates: "Carbohydrates",
  fat: "Fat",
})[nutrient];

const validateFoodInput = (input: DietFoodInput) => {
  if (!input.name.trim()) throw new Error("Food name is required.");
  if (input.name.trim().length > 100) throw new Error("Food name must be 100 characters or fewer.");
  if (!bases.has(input.referenceBasis) || !units.has(input.servingUnit)) throw new Error("Choose a valid nutrition basis and unit.");
  if (!Number.isFinite(input.servingSize) || input.servingSize <= 0) throw new Error("Serving size must be greater than zero.");
  if (input.referenceBasis === "per_100g" && input.servingUnit !== "g") throw new Error("Per 100 g values require the g unit.");
  if (input.referenceBasis === "per_100ml" && input.servingUnit !== "ml") throw new Error("Per 100 ml values require the ml unit.");
  validateNutrients(input);
};

const validateEntryInput = (input: DietEntryInput) => {
  if (!input.foodName.trim()) throw new Error("Food name is required.");
  if (input.foodName.trim().length > 100) throw new Error("Food name must be 100 characters or fewer.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be greater than zero.");
  if (!units.has(input.unit)) throw new Error("Choose a supported unit.");
  const timestamp = new Date(input.timestamp);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.timestamp) ||
      !Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== input.timestamp) {
    throw new Error("Choose a valid date and time.");
  }
  validateNutrients(input);
  if (input.notes && input.notes.length > 500) throw new Error("Notes must be 500 characters or fewer.");
};

export const getDietFoods = async (search = "") => {
  const db = await initDatabase();
  const term = search.trim();
  const result = await db.query(
    `SELECT id, name, reference_basis, serving_size, serving_unit,
            calories, protein, carbohydrates, fat, created_at, updated_at
     FROM diet_foods
     ${term ? "WHERE name LIKE ? COLLATE NOCASE" : ""}
     ORDER BY name COLLATE NOCASE ASC`,
    term ? [`%${term}%`] : [],
  );
  return (result.values ?? []).map(row => mapFood(row as Record<string, unknown>));
};

export const createDietFood = async (input: DietFoodInput) => {
  validateFoodInput(input);
  const db = await initDatabase();
  const now = new Date().toISOString();
  try {
    const result = await db.run(
      `INSERT INTO diet_foods
        (name, reference_basis, serving_size, serving_unit, calories, protein, carbohydrates, fat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.name.trim(), input.referenceBasis, input.servingSize, input.servingUnit, input.calories, input.protein,
        input.carbohydrates, input.fat, now, now],
    );
    await persist();
    return Number(result.changes?.lastId);
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error("A food with this name already exists.", { cause: error });
    }
    throw error;
  }
};

export const updateDietFood = async (id: number, input: DietFoodInput) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Food not found.");
  validateFoodInput(input);
  const db = await initDatabase();
  try {
    const result = await db.run(
      `UPDATE diet_foods SET name = ?, reference_basis = ?, serving_size = ?, serving_unit = ?,
         calories = ?, protein = ?, carbohydrates = ?, fat = ?, updated_at = ? WHERE id = ?`,
      [input.name.trim(), input.referenceBasis, input.servingSize, input.servingUnit, input.calories, input.protein,
        input.carbohydrates, input.fat, new Date().toISOString(), id],
    );
    if (Number(result.changes?.changes ?? 0) === 0) throw new Error("Food not found.");
    await persist();
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error("A food with this name already exists.", { cause: error });
    }
    throw error;
  }
};

export const deleteDietFood = async (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Food not found.");
  const db = await initDatabase();
  const result = await db.run("DELETE FROM diet_foods WHERE id = ?", [id]);
  if (Number(result.changes?.changes ?? 0) === 0) throw new Error("Food not found.");
  await persist();
};

export const getDietFoodById = async (id: number) => {
  const db = await initDatabase();
  const result = await db.query(
    `SELECT id, name, reference_basis, serving_size, serving_unit, calories, protein,
            carbohydrates, fat, created_at, updated_at FROM diet_foods WHERE id = ?`,
    [id],
  );
  const row = result.values?.[0];
  return row ? mapFood(row as Record<string, unknown>) : null;
};

export const getDietEntries = async (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("Choose a valid date.");
  }
  const db = await initDatabase();
  const [newRows, legacyRows] = await Promise.all([
    db.query(
      `SELECT id, food_id, food_name, quantity, unit, calories, protein, carbohydrates, fat, notes, timestamp
       FROM diet_entries WHERE date(timestamp, 'localtime') = ? ORDER BY timestamp DESC, id DESC`,
      [date],
    ),
    db.query(
      `SELECT id, food, quantity, unit, calories, protein, timestamp
       FROM food_logs WHERE date(timestamp, 'localtime') = ? ORDER BY timestamp DESC, id DESC`,
      [date],
    ),
  ]);
  const entries = [
    ...(newRows.values ?? []).map(row => mapEntry(row as Record<string, unknown>, "diet")),
    ...(legacyRows.values ?? []).map(row => mapEntry(row as Record<string, unknown>, "legacy")),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id);
  return entries;
};

export const createDietEntry = async (input: DietEntryInput) => {
  validateEntryInput(input);
  const db = await initDatabase();
  if (input.foodId !== null) {
    const food = await getDietFoodById(input.foodId);
    if (!food) throw new Error("The selected custom food no longer exists.");
    if (food.servingUnit !== input.unit) throw new Error(`This food is measured in ${food.servingUnit}; choose the same unit for the entry.`);
  }
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO diet_entries
      (food_id, food_name, quantity, unit, calories, protein, carbohydrates, fat, notes, timestamp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.foodId, input.foodName.trim(), input.quantity, input.unit, input.calories, input.protein,
      input.carbohydrates, input.fat, input.notes?.trim() || null, new Date(input.timestamp).toISOString(), now],
  );
  await persist();
  return Number(result.changes?.lastId);
};

export const updateDietEntry = async (id: number, input: DietEntryInput) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Entry not found.");
  validateEntryInput(input);
  const db = await initDatabase();
  if (input.foodId !== null) {
    const food = await getDietFoodById(input.foodId);
    if (!food) throw new Error("The selected custom food no longer exists.");
    if (food.servingUnit !== input.unit) throw new Error(`This food is measured in ${food.servingUnit}; choose the same unit for the entry.`);
  }
  const result = await db.run(
    `UPDATE diet_entries SET food_id = ?, food_name = ?, quantity = ?, unit = ?, calories = ?, protein = ?,
       carbohydrates = ?, fat = ?, notes = ?, timestamp = ? WHERE id = ?`,
    [input.foodId, input.foodName.trim(), input.quantity, input.unit, input.calories, input.protein,
      input.carbohydrates, input.fat, input.notes?.trim() || null, new Date(input.timestamp).toISOString(), id],
  );
  if (Number(result.changes?.changes ?? 0) === 0) throw new Error("Entry not found.");
  await persist();
};

export const deleteDietEntry = async (entry: Pick<DietEntry, "id" | "source">) => {
  if (entry.source !== "diet") throw new Error("Legacy food logs are preserved as read-only history.");
  if (!Number.isSafeInteger(entry.id) || entry.id <= 0) throw new Error("Entry not found.");
  const db = await initDatabase();
  const result = await db.run("DELETE FROM diet_entries WHERE id = ?", [entry.id]);
  if (Number(result.changes?.changes ?? 0) === 0) throw new Error("Entry not found.");
  await persist();
};

const targetLookupSql = `SELECT id, name, unit, target_value FROM metrics
  WHERE name = ? AND category = ? AND unit = ? AND frequency = 'daily'
    AND tracking_type = 'quantity' AND source = 'derived' ORDER BY id ASC`;

export const getDietTargets = async (): Promise<DietTargets> => {
  const db = await initDatabase();
  const targets = {} as DietTargets;
  for (const nutrient of NUTRIENTS) {
    const definition = targetDefinitions[nutrient];
    const result = await db.query(targetLookupSql, [definition.name, targetCategory, definition.unit]);
    if ((result.values?.length ?? 0) > 1) throw new Error(`Duplicate reserved ${nutrientLabel(nutrient)} targets need review.`);
    targets[nutrient] = result.values?.[0] ? Number(result.values[0].target_value) : null;
  }
  return targets;
};

export const saveDietTargets = async (targets: DietTargets) => {
  const requested = NUTRIENTS.filter(nutrient => targets[nutrient] !== null);
  if (!requested.length) throw new Error("Enter at least one target to save.");
  for (const nutrient of requested) {
    const value = targets[nutrient];
    if (value === null || !Number.isFinite(value) || value <= 0 || value > 1_000_000) {
      throw new Error(`${nutrientLabel(nutrient)} target must be greater than zero and no more than 1,000,000.`);
    }
  }

  const db = await initDatabase();
  const rows = await Promise.all(requested.map(async nutrient => {
    const definition = targetDefinitions[nutrient];
    const result = await db.query(targetLookupSql, [definition.name, targetCategory, definition.unit]);
    if ((result.values?.length ?? 0) > 1) throw new Error(`Duplicate reserved ${nutrientLabel(nutrient)} targets need review.`);
    return { nutrient, definition, value: targets[nutrient] as number, id: result.values?.[0] ? Number(result.values[0].id) : null };
  }));
  const maxOrderResult = await db.query("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM metrics");
  const firstOrder = Number(maxOrderResult.values?.[0]?.max_order ?? -1) + 1;
  const now = new Date().toISOString();
  const updates = rows.map((row, index) => row.id !== null
    ? { statement: "UPDATE metrics SET target_value = ?, enabled = 1, archived = 0, updated_at = ? WHERE id = ?", values: [row.value, now, row.id] }
    : {
      statement: `INSERT INTO metrics
        (name, icon, category, unit, target_value, frequency, tracking_type, source, enabled, archived, sort_order, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 'daily', 'quantity', 'derived', 1, 0, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM metrics WHERE name = ? AND category = ? AND unit = ?
          AND frequency = 'daily' AND tracking_type = 'quantity' AND source = 'derived')`,
      values: [row.definition.name, "🥗", targetCategory, row.definition.unit, row.value, firstOrder + index, now, now,
        row.definition.name, targetCategory, row.definition.unit],
    });
  await db.executeSet(updates, true);
  await persist();
};

export const getDietDayData = async (date: string): Promise<DietDayData> => {
  const [entries, targets] = await Promise.all([getDietEntries(date), getDietTargets()]);
  return {
    date,
    entries,
    entryCount: entries.length,
    totals: totalDailyNutrition(entries),
    targets,
    recentEntries: entries.slice(0, 3),
  };
};

export const getDietRangeData = async (startDate: string, endDate: string) => {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose valid report dates.");
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Choose valid report dates.");
    return date;
  };
  const start = parse(startDate);
  const end = parse(endDate);
  if (start > end) throw new Error("The report start date must be on or before its end date.");
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  const db = await initDatabase();
  const [[newRows, legacyRows], targets] = await Promise.all([
    Promise.all([
      db.query(`SELECT id, food_id, food_name, quantity, unit, calories, protein, carbohydrates, fat, notes, timestamp
        FROM diet_entries WHERE date(timestamp, 'localtime') BETWEEN ? AND ? ORDER BY timestamp, id`, [startDate, endDate]),
      db.query(`SELECT id, food, quantity, unit, calories, protein, timestamp
        FROM food_logs WHERE date(timestamp, 'localtime') BETWEEN ? AND ? ORDER BY timestamp, id`, [startDate, endDate]),
    ]),
    getDietTargets(),
  ]);
  const byDate = new Map(dates.map(date => [date, [] as DietEntry[]]));
  const entries = [
    ...(newRows.values ?? []).map(row => mapEntry(row as Record<string, unknown>, "diet")),
    ...(legacyRows.values ?? []).map(row => mapEntry(row as Record<string, unknown>, "legacy")),
  ];
  for (const entry of entries) {
    const day = new Date(entry.timestamp).toLocaleDateString("en-CA");
    byDate.get(day)?.push(entry);
  }
  const days = dates.map(date => {
    const dayEntries = byDate.get(date) ?? [];
    return { date, entryCount: dayEntries.length, totals: totalDailyNutrition(dayEntries) };
  });
  return { days, targets };
};

