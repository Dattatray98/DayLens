interface FoodResult {
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
}

interface WellnessResult {
    success?: boolean;
    action?: string;
    items?: FoodResult[];
    totals?: {
        calories: number;
        protein: number;
    };
    summary?: {
        foodCount: number;
        calories: number;
        protein: number;
    };
    steps?: number;
    message?: string;
    permissionRequired?: boolean;
}

export function formatWellnessResult(
    result: WellnessResult
): string {
    if (!result.success) {
        return `**Unable to complete request**\n\n${
            result.message ?? "Something went wrong."
        }`;
    }

    if (result.action === "log_food") {
        const items = result.items ?? [];
        const totals = result.totals;

        const foodLines = items.map(
            (item) =>
                `- **${item.quantity}${item.unit} ${item.food}** · ${item.calories} kcal · ${item.protein}g protein`
        );

        return [
            "### Food logged",
            "",
            ...foodLines,
            "",
            `🔥 **${totals?.calories ?? 0} kcal**`,
            `💪 **${totals?.protein ?? 0}g protein**`,
            "",
            "Saved to local history.",
        ].join("\n");
    }

    if (result.action === "get_summary") {
        const summary = result.summary;

        return [
            "### Today's Summary",
            "",
            `🍽️ **${summary?.foodCount ?? 0} food items**`,
            `🔥 **${summary?.calories ?? 0} kcal**`,
            `💪 **${summary?.protein ?? 0}g protein**`,
        ].join("\n");
    }

    if (result.action === "get_steps") {
        return [
            "### Activity",
            "",
            `👣 **${result.steps ?? 0} steps**`,
        ].join("\n");
    }

    return result.message ?? "Request completed.";
}
