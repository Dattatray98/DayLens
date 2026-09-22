export interface NutritionData {
    calories: number;
    protein: number;
}

export const nutritionData: Record<string, NutritionData> = {
    soya: {
        calories: 446,
        protein: 36.5,
    },

    "soya milk": {
        calories: 54,
        protein: 3.3,
    },

    rice: {
        calories: 130,
        protein: 2.7,
    },

    egg: {
        calories: 155,
        protein: 13,
    },

    chicken: {
        calories: 239,
        protein: 27.3,
    },

    "chicken breast": {
        calories: 165,
        protein: 31,
    },

    milk: {
        calories: 61,
        protein: 3.2,
    },

    banana: {
        calories: 89,
        protein: 1.1,
    },

    roti: {
        calories: 297,
        protein: 11,
    },
};
