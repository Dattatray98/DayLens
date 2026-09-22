export interface FoodResult {
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
}

export interface PlanGoalResult {
    id?: number;
    name: string;
    icon?: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    remaining: number;
    progressPercent: number;
    isCompleted: boolean;
    frequency?: string;
}

export interface WellnessResult {
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
    isUnsupportedIntent?: boolean;
    isMalformedOutput?: boolean;

    // Plan-specific fields
    metricId?: number;
    name?: string;
    targetValue?: number;
    previousTarget?: number;
    newTarget?: number;
    unit?: string;
    frequency?: string;
    trackingType?: string;
    alreadyExists?: boolean;
    loggedValue?: number;
    currentValue?: number;
    remaining?: number;
    isCompleted?: boolean;
    progressPercent?: number;
    date?: string;
    subAction?: 'archive' | 'disable';
    planItems?: PlanGoalResult[];
    candidates?: Array<{ id?: number; name: string; targetValue: number; unit: string }>;
}

export function formatWellnessResult(
    result: WellnessResult
): string {
    // 1. Ambiguity handling
    if (result.action === "ambiguous_metric" && result.candidates?.length) {
        const candidateLines = result.candidates.map(
            (c) => `• **${c.name}** (${c.targetValue} ${c.unit})`
        );
        return [
            "### Multiple matching goals found",
            "",
            ...candidateLines,
            "",
            result.message ?? "Which one would you like to update?",
        ].join("\n");
    }

    // 2. Natural-language fallback for unsupported intents
    if (result.isUnsupportedIntent) {
        return result.message ?? "This capability is not currently supported by local tools.";
    }

    // 3. Technical fallback for malformed/unparseable model output
    if (result.isMalformedOutput) {
        return `**Unable to process request**\n\n${
            result.message ?? "Local model output format was invalid."
        }`;
    }

    // 4. Tool execution failure
    if (!result.success) {
        return `**Unable to complete request**\n\n${
            result.message ?? "Something went wrong."
        }`;
    }

    // 5. Plan tools formatting
    if (result.action === "create_metric") {
        return `Added a ${result.frequency ?? "daily"} **${result.name}** target of **${result.targetValue} ${result.unit}**.`;
    }

    if (result.action === "update_metric") {
        return `Updated your **${result.name}** target to **${result.newTarget ?? result.targetValue} ${result.unit}** per ${result.frequency ?? "day"}.`;
    }

    if (result.action === "log_metric_progress") {
        if (result.isCompleted) {
            return `Marked **${result.name}** as completed! (${result.currentValue} / ${result.targetValue} ${result.unit})`;
        }
        return `You've logged ${result.loggedValue} ${result.unit} for **${result.name}** today. Today: ${result.currentValue} / ${result.targetValue} ${result.unit} (${result.remaining} ${result.unit} remaining).`;
    }

    if (result.action === "get_plan") {
        const planList: PlanGoalResult[] = ((result.planItems ?? result.items ?? []) as unknown) as PlanGoalResult[];
        if (planList.length === 0) {
            return `No active goals found for ${result.date ?? "today"}. You can add one by saying "Add a water goal of 2.5 liters daily".`;
        }

        const lines = planList.map((item) => {
            const check = item.isCompleted ? " ✅" : "";
            const icon = item.icon ? `${item.icon} ` : "";
            return `• ${icon}**${item.name}**: ${item.currentValue} / ${item.targetValue} ${item.unit} (${item.progressPercent}%)${check}`;
        });

        const completedCount = planList.filter((i) => i.isCompleted).length;

        return [
            `### Today's Plan (${result.date ?? "Today"})`,
            "",
            `**${completedCount} of ${planList.length} completed**`,
            "",
            ...lines,
        ].join("\n");
    }

    if (result.action === "delete_metric") {
        const verb = result.subAction === "disable" ? "Disabled" : "Archived";
        return `${verb} **${result.name}** in your Plan.`;
    }

    // 6. Existing food / steps / summary tools
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
