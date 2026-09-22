import { nutritionData } from './nutritionData';

export interface CalculatedFood {
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
}

function normalizeFoodName(food: string): string {
    return food.trim().toLowerCase();
}

export function calculateNutrition(
    food: string,
    quantity: number,
    unit: string
): CalculatedFood {
    const normalizedFood = normalizeFoodName(food);

    const nutrition = nutritionData[normalizedFood];

    if (!nutrition) {
        throw new Error(
            `Food not found in local nutrition database: ${food}`
        );
    }

    if (unit.toLowerCase() !== 'g' && unit.toLowerCase() !== 'gram' && unit.toLowerCase() !== 'grams') {
        throw new Error(
            `Unsupported nutrition unit for ${food}: ${unit}`
        );
    }

    const multiplier = quantity / 100;

    return {
        food: normalizedFood,
        quantity,
        unit,
        calories: Number((nutrition.calories * multiplier).toFixed(2)),
        protein: Number((nutrition.protein * multiplier).toFixed(2)),
    };
}
