import { tool } from '@langchain/core/tools';
import { LogFoodInputSchema } from './schemas';
import { calculateNutrition } from '../database/nutritionCalculator';
import { saveFoodLogs } from '../database/foodRepository';

export const logFoodTool = tool(
    async ({ items }) => {
        const calculatedItems = items.map((item) =>
            calculateNutrition(
                item.food,
                item.quantity,
                item.unit
            )
        );

        const totalCalories = calculatedItems.reduce(
            (total, item) => total + item.calories,
            0
        );

        const totalProtein = calculatedItems.reduce(
            (total, item) => total + item.protein,
            0
        );

        await saveFoodLogs(calculatedItems);

        return {
            success: true,
            action: 'log_food',
            items: calculatedItems,
            totals: {
                calories: Number(totalCalories.toFixed(2)),
                protein: Number(totalProtein.toFixed(2)),
            },
            message: `Logged ${calculatedItems.length} food item${
                calculatedItems.length === 1 ? '' : 's'
            } and saved to local history.`,
        };
    },
    {
        name: 'log_food',
        description:
            'Log one or more foods eaten by the user, calculate nutrition using the local nutrition database, and save the result to local history.',
        schema: LogFoodInputSchema,
    }
);
