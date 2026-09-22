import { nutritionData, getCanonicalFood } from './nutritionData';

export interface CalculatedFood {
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
}

export class UnknownFoodError extends Error {
    readonly foodName: string;

    constructor(foodName: string) {
        super(
            `I can log foods from my local nutrition dataset, but I don't currently have nutrition data for "${foodName}". I won't guess the calories or protein.`
        );
        this.name = 'UnknownFoodError';
        this.foodName = foodName;
    }
}

const GRAM_UNITS = new Set(['g', 'gram', 'grams', 'gm', 'gms']);
const KG_UNITS = new Set(['kg', 'kilogram', 'kilograms']);
const ML_UNITS = new Set(['ml', 'milliliter', 'milliliters']);
const L_UNITS = new Set(['l', 'liter', 'liters']);
const COUNT_UNITS = new Set([
    'piece',
    'pieces',
    'pc',
    'pcs',
    'unit',
    'units',
    'item',
    'items',
    'whole',
    'count',
    'slice',
    'slices',
]);

export function calculateNutrition(
    food: string,
    quantity: number,
    unit: string
): CalculatedFood {
    const canonicalFood = getCanonicalFood(food);

    if (!canonicalFood) {
        throw new UnknownFoodError(food);
    }

    const nutrition = nutritionData[canonicalFood];

    if (!nutrition) {
        throw new UnknownFoodError(food);
    }

    const normalizedUnit = (unit || '').trim().toLowerCase();
    const rawFoodNormalized = (food || '').trim().toLowerCase();

    let multiplier: number;

    if (GRAM_UNITS.has(normalizedUnit)) {
        multiplier = quantity / 100;
    } else if (KG_UNITS.has(normalizedUnit)) {
        multiplier = (quantity * 1000) / 100;
    } else if (ML_UNITS.has(normalizedUnit)) {
        // Density of milk / liquid dairy ~1.03 g/ml -> 1ml ~ 1g
        multiplier = quantity / 100;
    } else if (L_UNITS.has(normalizedUnit)) {
        multiplier = (quantity * 1000) / 100;
    } else if (
        COUNT_UNITS.has(normalizedUnit) ||
        normalizedUnit === canonicalFood ||
        normalizedUnit === `${canonicalFood}s` ||
        normalizedUnit === rawFoodNormalized ||
        normalizedUnit === `${rawFoodNormalized}s` ||
        normalizedUnit === 'egg' ||
        normalizedUnit === 'eggs' ||
        normalizedUnit === 'roti' ||
        normalizedUnit === 'rotis' ||
        normalizedUnit === 'banana' ||
        normalizedUnit === 'bananas' ||
        normalizedUnit === 'idli' ||
        normalizedUnit === 'idlis' ||
        normalizedUnit === 'chappathi' ||
        normalizedUnit === 'chapati' ||
        normalizedUnit === 'chapatis' ||
        normalizedUnit === 'apple' ||
        normalizedUnit === 'apples'
    ) {
        if (!nutrition.servingWeightG) {
            throw new Error(
                `Please specify quantity in grams for ${canonicalFood}.`
            );
        }
        const effectiveGrams = quantity * nutrition.servingWeightG;
        multiplier = effectiveGrams / 100;
    } else {
        throw new Error(
            `Unsupported nutrition unit for ${canonicalFood}: ${unit}. Please specify quantity in grams (g) or standard servings.`
        );
    }

    return {
        food: canonicalFood,
        quantity,
        unit,
        calories: Number((nutrition.calories * multiplier).toFixed(2)),
        protein: Number((nutrition.protein * multiplier).toFixed(2)),
    };
}
