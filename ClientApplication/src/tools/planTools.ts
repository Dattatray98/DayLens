import { tool } from '@langchain/core/tools';
import {
  CreateMetricInputSchema,
  UpdateMetricInputSchema,
  LogMetricProgressInputSchema,
  GetPlanInputSchema,
  DeleteMetricInputSchema,
  type CreateMetricInputZod,
  type UpdateMetricInputZod,
  type LogMetricProgressInputZod,
  type GetPlanInputZod,
  type DeleteMetricInputZod,
} from './schemas';
import {
  archiveMetric,
  createMetric,
  getActiveMetrics,
  getMetrics,
  getPlanProgress,
  logMetric,
  updateMetric,
} from '../database/metricRepository';
import type {
  CreateMetricInput,
  MetricDefinition,
  MetricFrequency,
  MetricTrackingType,
  PlanItemProgress,
} from '../database/metrics';

export function resolveDateString(dateStr?: string): string {
  if (!dateStr || dateStr.toLowerCase() === 'today') {
    return new Date().toLocaleDateString('en-CA');
  }
  const lower = dateStr.trim().toLowerCase();
  if (lower === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA');
  }
  if (lower === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return lower;
  }
  return new Date().toLocaleDateString('en-CA');
}

export function convertMetricUnit(
  value: number,
  fromUnit?: string,
  toUnit?: string
): number {
  if (!fromUnit || !toUnit) return value;
  const from = fromUnit.trim().toLowerCase();
  const to = toUnit.trim().toLowerCase();

  if (from === to) return value;

  // Volume conversions: Liters <-> ml
  if (
    (from === 'l' || from === 'liter' || from === 'liters') &&
    (to === 'ml' || to === 'milliliter' || to === 'milliliters')
  ) {
    return value * 1000;
  }
  if (
    (from === 'ml' || from === 'milliliter' || from === 'milliliters') &&
    (to === 'l' || to === 'liter' || to === 'liters')
  ) {
    return value / 1000;
  }

  // Duration conversions: Hours <-> Minutes
  if (
    (from === 'h' || from === 'hr' || from === 'hrs' || from === 'hour' || from === 'hours') &&
    (to === 'min' || to === 'mins' || to === 'minute' || to === 'minutes')
  ) {
    return value * 60;
  }
  if (
    (from === 'min' || from === 'mins' || from === 'minute' || from === 'minutes') &&
    (to === 'h' || to === 'hr' || to === 'hrs' || to === 'hour' || to === 'hours')
  ) {
    return value / 60;
  }

  // Weight conversions: kg <-> grams
  if (
    (from === 'kg' || from === 'kilogram' || from === 'kilograms') &&
    (to === 'g' || to === 'gram' || to === 'grams')
  ) {
    return value * 1000;
  }
  if (
    (from === 'g' || from === 'gram' || from === 'grams') &&
    (to === 'kg' || to === 'kilogram' || to === 'kilograms')
  ) {
    return value / 1000;
  }

  // Distance conversions: km <-> m
  if (
    (from === 'km' || from === 'kilometer' || from === 'kilometers') &&
    (to === 'm' || to === 'meter' || to === 'meters')
  ) {
    return value * 1000;
  }
  if (
    (from === 'm' || from === 'meter' || from === 'meters') &&
    (to === 'km' || to === 'kilometer' || to === 'kilometers')
  ) {
    return value / 1000;
  }

  return value;
}

export function normalizeMetricName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(my|our|the|goal|goals|target|targets|task|tasks|item|items|plan)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type MetricResolutionResult =
  | { status: 'found'; metric: MetricDefinition }
  | { status: 'ambiguous'; candidates: MetricDefinition[] }
  | { status: 'not_found' };

export function resolveMetric(
  identifier: { metricId?: number; metricName?: string },
  metrics: MetricDefinition[]
): MetricResolutionResult {
  if (identifier.metricId !== undefined) {
    const found = metrics.find((m) => m.id === identifier.metricId);
    if (found) return { status: 'found', metric: found };
    return { status: 'not_found' };
  }

  if (!identifier.metricName) {
    return { status: 'not_found' };
  }

  const rawName = identifier.metricName.trim().toLowerCase();
  const cleanTarget = normalizeMetricName(identifier.metricName);
  const searchWord = cleanTarget || rawName;

  // Prefer enabled metrics if available, otherwise consider all unarchived
  const enabledMetrics = metrics.filter((m) => m.enabled && !m.archived);
  const targetPool = enabledMetrics.length > 0 ? enabledMetrics : metrics;

  // Find all matches in target pool
  const relatedMatches = targetPool.filter((m) => {
    const mNorm = normalizeMetricName(m.name);
    const mRaw = m.name.toLowerCase();
    return (
      mNorm === cleanTarget ||
      mRaw === rawName ||
      mNorm.includes(searchWord) ||
      searchWord.includes(mNorm) ||
      mRaw.includes(searchWord) ||
      searchWord.includes(mRaw)
    );
  });

  if (relatedMatches.length === 1) {
    return { status: 'found', metric: relatedMatches[0] };
  }

  if (relatedMatches.length > 1) {
    // If the user specified an exact multi-word name that matches uniquely:
    const exactMatches = relatedMatches.filter(
      (m) => m.name.trim().toLowerCase() === rawName
    );
    // If there is an exact match and user query was multi-word (e.g. "morning workout")
    if (exactMatches.length === 1 && rawName.split(/\s+/).length > 1) {
      return { status: 'found', metric: exactMatches[0] };
    }
    // Otherwise ambiguous (e.g. user said "my workout" when "Morning workout" and "Evening workout" exist)
    return { status: 'ambiguous', candidates: relatedMatches };
  }

  // Fallback to all metrics (including disabled) if none matched in enabled
  const fallbackMatches = metrics.filter((m) => {
    const mNorm = normalizeMetricName(m.name);
    const mRaw = m.name.toLowerCase();
    return (
      mNorm === cleanTarget ||
      mRaw === rawName ||
      mNorm.includes(searchWord) ||
      searchWord.includes(mNorm) ||
      mRaw.includes(searchWord) ||
      searchWord.includes(mRaw)
    );
  });

  if (fallbackMatches.length === 1) {
    return { status: 'found', metric: fallbackMatches[0] };
  }
  if (fallbackMatches.length > 1) {
    return { status: 'ambiguous', candidates: fallbackMatches };
  }

  return { status: 'not_found' };
}

const PRESET_METRIC_TEMPLATES: Record<
  string,
  {
    name: string;
    icon: string;
    category: string;
    unit: string;
    targetValue: number;
    frequency: MetricFrequency;
    trackingType: MetricTrackingType;
  }
> = {
  water: {
    name: 'Water',
    icon: '💧',
    category: 'wellness',
    unit: 'ml',
    targetValue: 2500,
    frequency: 'daily',
    trackingType: 'quantity',
  },
  steps: {
    name: 'Steps',
    icon: '🚶',
    category: 'fitness',
    unit: 'steps',
    targetValue: 8000,
    frequency: 'daily',
    trackingType: 'quantity',
  },
  workout: {
    name: 'Workout',
    icon: '🏋️',
    category: 'fitness',
    unit: 'min',
    targetValue: 30,
    frequency: 'daily',
    trackingType: 'duration',
  },
  protein: {
    name: 'Protein',
    icon: '🥩',
    category: 'nutrition',
    unit: 'g',
    targetValue: 140,
    frequency: 'daily',
    trackingType: 'quantity',
  },
  sleep: {
    name: 'Sleep',
    icon: '😴',
    category: 'wellness',
    unit: 'hours',
    targetValue: 8,
    frequency: 'daily',
    trackingType: 'duration',
  },
};

export const createMetricTool = tool(
  async (input: CreateMetricInputZod) => {
    try {
      const activeMetrics = await getActiveMetrics();

      // Check if metric already exists
      const resolution = resolveMetric(
        { metricName: input.name },
        activeMetrics
      );

      if (resolution.status === 'found') {
        const existing = resolution.metric;
        // Apply unit conversion if needed for target
        const convertedTarget = convertMetricUnit(
          input.targetValue,
          input.unit,
          existing.unit
        );

        // Update the existing metric instead of creating a duplicate
        await updateMetric(existing.id, {
          targetValue: convertedTarget,
          frequency: input.frequency,
          unit: existing.unit,
          enabled: true,
        });

        return {
          success: true,
          action: 'update_metric',
          alreadyExists: true,
          metricId: existing.id,
          name: existing.name,
          targetValue: convertedTarget,
          unit: existing.unit,
          frequency: input.frequency,
          trackingType: existing.trackingType,
          message: `Updated existing goal for ${existing.name} to ${convertedTarget} ${existing.unit} (${input.frequency}).`,
        };
      }

      // Infer defaults for known types
      const normalizedName = normalizeMetricName(input.name);
      const preset = PRESET_METRIC_TEMPLATES[normalizedName];

      let targetUnit = input.unit;
      let finalTargetValue = input.targetValue;
      let trackingType = input.trackingType;
      let icon = input.icon || '📊';
      let category = input.category || 'custom';

      if (preset) {
        icon = input.icon && input.icon !== '📊' ? input.icon : preset.icon;
        category =
          input.category && input.category !== 'custom'
            ? input.category
            : preset.category;
        if (
          normalizedName === 'water' &&
          (input.unit.toLowerCase() === 'l' ||
            input.unit.toLowerCase() === 'liter' ||
            input.unit.toLowerCase() === 'liters')
        ) {
          targetUnit = 'ml';
          finalTargetValue = input.targetValue * 1000;
        } else if (
          (normalizedName === 'workout' || normalizedName === 'exercise') &&
          (input.unit.toLowerCase() === 'h' ||
            input.unit.toLowerCase() === 'hr' ||
            input.unit.toLowerCase() === 'hour' ||
            input.unit.toLowerCase() === 'hours')
        ) {
          targetUnit = 'min';
          finalTargetValue = input.targetValue * 60;
        }
      }

      // Check duration inference
      if (
        targetUnit === 'min' ||
        targetUnit === 'mins' ||
        targetUnit === 'minutes' ||
        targetUnit === 'hours' ||
        targetUnit === 'h'
      ) {
        trackingType = 'duration';
      }

      const createInput: CreateMetricInput = {
        name: input.name.trim(),
        icon,
        category,
        unit: targetUnit,
        targetValue: finalTargetValue,
        frequency: input.frequency,
        trackingType,
        source: 'manual',
      };

      const result = await createMetric(createInput);

      return {
        success: true,
        action: 'create_metric',
        metricId: result.id,
        name: createInput.name,
        targetValue: createInput.targetValue,
        unit: createInput.unit,
        frequency: createInput.frequency,
        trackingType: createInput.trackingType,
        message: `Added a ${createInput.frequency} ${createInput.name} target of ${createInput.targetValue} ${createInput.unit}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create goal';
      return {
        success: false,
        action: 'create_metric',
        message: msg,
      };
    }
  },
  {
    name: 'create_metric',
    description: 'Create a new Plan metric or goal with target value, unit, and frequency.',
    schema: CreateMetricInputSchema,
  }
);

export const updateMetricTool = tool(
  async (input: UpdateMetricInputZod) => {
    try {
      const allMetrics = await getMetrics(false);
      const resolution = resolveMetric(
        { metricId: input.metricId, metricName: input.metricName },
        allMetrics
      );

      if (resolution.status === 'not_found') {
        return {
          success: false,
          action: 'update_metric',
          message: `No active goal found for "${input.metricName ?? input.metricId}".`,
        };
      }

      if (resolution.status === 'ambiguous') {
        return {
          success: false,
          action: 'ambiguous_metric',
          candidates: resolution.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            targetValue: c.targetValue,
            unit: c.unit,
          })),
          message: `I found ${resolution.candidates.length} goals matching "${input.metricName}": ${resolution.candidates.map((c) => `'${c.name}'`).join(', ')}. Which one do you want to update?`,
        };
      }

      const metric = resolution.metric;
      let newTarget = input.changes.targetValue;
      if (newTarget !== undefined && input.changes.unit) {
        newTarget = convertMetricUnit(
          newTarget,
          input.changes.unit,
          metric.unit
        );
      } else if (newTarget !== undefined) {
        // If target value is changed without unit, keep metric's unit
      }

      await updateMetric(metric.id, {
        name: input.changes.name ?? metric.name,
        targetValue: newTarget !== undefined ? newTarget : metric.targetValue,
        unit: metric.unit,
        frequency: input.changes.frequency ?? metric.frequency,
        trackingType: input.changes.trackingType ?? metric.trackingType,
        category: input.changes.category ?? metric.category,
        icon: input.changes.icon ?? metric.icon,
        enabled: input.changes.enabled !== undefined ? input.changes.enabled : metric.enabled,
      });

      return {
        success: true,
        action: 'update_metric',
        metricId: metric.id,
        name: input.changes.name ?? metric.name,
        previousTarget: metric.targetValue,
        newTarget: newTarget !== undefined ? newTarget : metric.targetValue,
        unit: metric.unit,
        frequency: input.changes.frequency ?? metric.frequency,
        message: `Updated your ${input.changes.name ?? metric.name} target to ${newTarget !== undefined ? newTarget : metric.targetValue} ${metric.unit} per ${input.changes.frequency ?? metric.frequency}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update goal';
      return {
        success: false,
        action: 'update_metric',
        message: msg,
      };
    }
  },
  {
    name: 'update_metric',
    description: 'Update an existing Plan metric target, frequency, or name.',
    schema: UpdateMetricInputSchema,
  }
);

export const logMetricProgressTool = tool(
  async (input: LogMetricProgressInputZod) => {
    try {
      const targetDate = resolveDateString(input.date);
      let allMetrics = await getMetrics(false);

      let resolution = resolveMetric(
        { metricId: input.metricId, metricName: input.metricName },
        allMetrics
      );

      // If metric not found, check if it matches a preset template (e.g. water, workout)
      if (resolution.status === 'not_found' && input.metricName) {
        const norm = normalizeMetricName(input.metricName);
        const preset = PRESET_METRIC_TEMPLATES[norm];
        if (preset) {
          const created = await createMetric({
            name: preset.name,
            icon: preset.icon,
            category: preset.category,
            unit: preset.unit,
            targetValue: preset.targetValue,
            frequency: preset.frequency,
            trackingType: preset.trackingType,
            source: 'manual',
          });
          allMetrics = await getMetrics(false);
          const found = allMetrics.find((m: MetricDefinition) => m.id === created.id);
          if (found) {
            resolution = { status: 'found', metric: found };
          }
        }
      }

      if (resolution.status === 'not_found') {
        return {
          success: false,
          action: 'log_metric_progress',
          message: `No active goal found for "${input.metricName ?? input.metricId}". You can add one by saying "Add a ${input.metricName} goal".`,
        };
      }

      if (resolution.status === 'ambiguous') {
        return {
          success: false,
          action: 'ambiguous_metric',
          candidates: resolution.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            targetValue: c.targetValue,
            unit: c.unit,
          })),
          message: `I found ${resolution.candidates.length} goals matching "${input.metricName}": ${resolution.candidates.map((c) => `'${c.name}'`).join(', ')}. Which one do you want to update?`,
        };
      }

      const metric = resolution.metric;

      // Determine logged numeric value
      let loggedValue: number;
      if (metric.trackingType === 'boolean' || input.isCompleted) {
        loggedValue = metric.targetValue > 0 ? metric.targetValue : 1;
      } else if (input.value !== undefined) {
        loggedValue = convertMetricUnit(input.value, input.unit, metric.unit);
      } else {
        loggedValue = 1;
      }

      // Generate timestamp aligned to local date
      const timestamp =
        targetDate === new Date().toLocaleDateString('en-CA')
          ? new Date().toISOString()
          : `${targetDate}T12:00:00.000Z`;

      await logMetric(metric.id, loggedValue, input.note ?? undefined, timestamp);

      // Fetch updated plan progress
      const planItems = await getPlanProgress(targetDate);
      const currentProgress: PlanItemProgress | undefined = planItems.find(
        (p) => p.metric.id === metric.id
      );

      const currentValue = currentProgress?.currentValue ?? loggedValue;
      const targetValue = currentProgress?.targetValue ?? metric.targetValue;
      const remaining = Math.max(0, Number((targetValue - currentValue).toFixed(2)));
      const isCompleted = currentProgress?.isCompleted ?? currentValue >= targetValue;
      const progressPercent = currentProgress?.progressPercent ?? Math.min(100, Math.round((currentValue / targetValue) * 100));

      return {
        success: true,
        action: 'log_metric_progress',
        metricId: metric.id,
        name: metric.name,
        loggedValue,
        unit: metric.unit,
        currentValue,
        targetValue,
        remaining,
        isCompleted,
        progressPercent,
        date: targetDate,
        message: isCompleted
          ? `Marked ${metric.name} as completed!`
          : `Logged ${loggedValue} ${metric.unit} for ${metric.name}. Today: ${currentValue} / ${targetValue} ${metric.unit} (${remaining} ${metric.unit} remaining).`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log progress';
      return {
        success: false,
        action: 'log_metric_progress',
        message: msg,
      };
    }
  },
  {
    name: 'log_metric_progress',
    description: 'Log progress or mark completion for an existing Plan metric or goal.',
    schema: LogMetricProgressInputSchema,
  }
);

export const getPlanTool = tool(
  async (input: GetPlanInputZod) => {
    try {
      const targetDate = resolveDateString(input.date);
      const planItems = await getPlanProgress(targetDate);

      // Filter enabled items
      let items = planItems.filter((p) => p.metric.enabled && !p.metric.archived);

      if (input.metricName) {
        const resolution = resolveMetric(
          { metricName: input.metricName },
          items.map((i) => i.metric)
        );

        if (resolution.status === 'found') {
          items = items.filter((i) => i.metric.id === resolution.metric.id);
        } else if (resolution.status === 'ambiguous') {
          return {
            success: false,
            action: 'ambiguous_metric',
            candidates: resolution.candidates.map((c) => ({
              id: c.id,
              name: c.name,
              targetValue: c.targetValue,
              unit: c.unit,
            })),
            message: `I found ${resolution.candidates.length} goals matching "${input.metricName}": ${resolution.candidates.map((c) => `'${c.name}'`).join(', ')}. Which one would you like to view?`,
          };
        } else {
          return {
            success: false,
            action: 'get_plan',
            message: `No active goal found for "${input.metricName}".`,
          };
        }
      }

      const formattedItems = items.map((item) => ({
        id: item.metric.id,
        name: item.metric.name,
        icon: item.metric.icon,
        currentValue: item.currentValue,
        targetValue: item.targetValue,
        unit: item.metric.unit,
        remaining: Math.max(0, Number((item.targetValue - item.currentValue).toFixed(2))),
        progressPercent: item.progressPercent,
        isCompleted: item.isCompleted,
        frequency: item.metric.frequency,
      }));

      return {
        success: true,
        action: 'get_plan',
        date: targetDate,
        items: formattedItems,
        totalGoals: formattedItems.length,
        completedGoals: formattedItems.filter((i) => i.isCompleted).length,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve plan';
      return {
        success: false,
        action: 'get_plan',
        message: msg,
      };
    }
  },
  {
    name: 'get_plan',
    description: "Get the user's Plan / Daily Matrix goals and progress for today or a specific date.",
    schema: GetPlanInputSchema,
  }
);

export const deleteMetricTool = tool(
  async (input: DeleteMetricInputZod) => {
    try {
      const allMetrics = await getMetrics(false);
      const resolution = resolveMetric(
        { metricId: input.metricId, metricName: input.metricName },
        allMetrics
      );

      if (resolution.status === 'not_found') {
        return {
          success: false,
          action: 'delete_metric',
          message: `No active goal found for "${input.metricName ?? input.metricId}".`,
        };
      }

      if (resolution.status === 'ambiguous') {
        return {
          success: false,
          action: 'ambiguous_metric',
          candidates: resolution.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            targetValue: c.targetValue,
            unit: c.unit,
          })),
          message: `I found ${resolution.candidates.length} goals matching "${input.metricName}": ${resolution.candidates.map((c) => `'${c.name}'`).join(', ')}. Which one do you want to remove?`,
        };
      }

      const metric = resolution.metric;
      if (input.action === 'disable') {
        await updateMetric(metric.id, { enabled: false });
        return {
          success: true,
          action: 'delete_metric',
          metricId: metric.id,
          name: metric.name,
          subAction: 'disable',
          message: `Disabled ${metric.name} in your Plan.`,
        };
      }

      await archiveMetric(metric.id);
      return {
        success: true,
        action: 'delete_metric',
        metricId: metric.id,
        name: metric.name,
        subAction: 'archive',
        message: `Archived ${metric.name} from your Plan.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive goal';
      return {
        success: false,
        action: 'delete_metric',
        message: msg,
      };
    }
  },
  {
    name: 'delete_metric',
    description: 'Archive or disable an existing Plan metric.',
    schema: DeleteMetricInputSchema,
  }
);
