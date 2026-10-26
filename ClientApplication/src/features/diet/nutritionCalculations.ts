export const NUTRIENTS = ["calories", "protein", "carbohydrates", "fat"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];
export type NutritionValues = Record<Nutrient, number | null>;
export type FoodUnit = "g" | "ml" | "piece" | "serving";
export type FoodReferenceBasis = "per_100g" | "per_100ml" | "per_serving";

export interface FoodReference {
  referenceBasis: FoodReferenceBasis;
  servingSize: number;
  servingUnit: FoodUnit;
  nutrition: NutritionValues;
}

export interface NutritionEntryValues extends NutritionValues {
  quantity: number;
  unit: FoodUnit;
}

export interface NutrientTotal {
  value: number;
  knownEntries: number;
  entryCount: number;
  complete: boolean;
}

export type DailyNutritionTotals = Record<Nutrient, NutrientTotal>;

const roundForDisplay = (value: number) => Number(value.toFixed(2));

export const calculateFoodNutrition = (
  food: FoodReference,
  quantity: number,
  unit: FoodUnit,
): NutritionValues => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }
  if (unit !== food.servingUnit) {
    throw new Error(`This food is measured in ${food.servingUnit}; choose the same unit for the entry.`);
  }
  if ((food.referenceBasis === "per_100g" && food.servingUnit !== "g") ||
      (food.referenceBasis === "per_100ml" && food.servingUnit !== "ml")) {
    throw new Error("Nutrition basis and food unit do not match.");
  }
  if (!Number.isFinite(food.servingSize) || food.servingSize <= 0) {
    throw new Error("Serving size must be greater than zero.");
  }

  const referenceQuantity = food.referenceBasis === "per_100g" || food.referenceBasis === "per_100ml"
    ? 100
    : food.servingSize;
  const multiplier = quantity / referenceQuantity;

  return Object.fromEntries(NUTRIENTS.map(nutrient => {
    const value = food.nutrition[nutrient];
    return [nutrient, value === null ? null : roundForDisplay(value * multiplier)];
  })) as NutritionValues;
};

export const scaleNutritionSnapshot = (
  values: NutritionValues,
  previousQuantity: number,
  nextQuantity: number,
): NutritionValues => {
  if (!Number.isFinite(previousQuantity) || previousQuantity <= 0 || !Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }
  const multiplier = nextQuantity / previousQuantity;
  return Object.fromEntries(NUTRIENTS.map(nutrient => {
    const value = values[nutrient];
    return [nutrient, value === null ? null : roundForDisplay(value * multiplier)];
  })) as NutritionValues;
};

export const totalDailyNutrition = (entries: NutritionValues[]): DailyNutritionTotals =>
  Object.fromEntries(NUTRIENTS.map(nutrient => {
    const knownValues = entries.flatMap(entry => entry[nutrient] === null ? [] : [entry[nutrient] as number]);
    const value = knownValues.reduce((total, item) => total + item, 0);
    return [nutrient, {
      value: roundForDisplay(value),
      knownEntries: knownValues.length,
      entryCount: entries.length,
      complete: entries.length > 0 && knownValues.length === entries.length,
    }];
  })) as DailyNutritionTotals;

