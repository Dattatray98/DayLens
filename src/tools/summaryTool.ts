import { tool } from '@langchain/core/tools';
import { GetSummaryInputSchema } from './schemas';
import { getTodaySummary } from '../database/foodRepository';

export const getSummaryTool = tool(
    async () => {
        const summary = await getTodaySummary();

        return {
            success: true,
            action: 'get_summary',
            summary,
            message:
                summary.foodCount === 0
                    ? "No food has been logged today."
                    : `Today you logged ${summary.foodCount} food item${
                          summary.foodCount === 1 ? '' : 's'
                      }, totaling ${summary.calories} kcal and ${summary.protein} g protein.`,
        };
    },
    {
        name: 'get_summary',
        description:
            "Get today's nutrition summary from locally stored food history.",
        schema: GetSummaryInputSchema,
    }
);
