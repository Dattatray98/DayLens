import { wellnessToolRegistry } from './registry';
import {
  LogFoodInputSchema,
  CreateMetricInputSchema,
  UpdateMetricInputSchema,
  LogMetricProgressInputSchema,
  GetPlanInputSchema,
  DeleteMetricInputSchema,
} from './schemas';
import type { WellnessResult } from '../utils/formatWellnessResult';
import { isKnownFood } from '../database/nutritionData';

export type WellnessIntent =
  | {
      action: 'log_food';
      items: Array<{
        food: string;
        quantity: number;
        unit: string;
      }>;
    }
  | {
      action: 'get_steps';
    }
  | {
      action: 'get_summary';
    }
  | {
      action: 'create_metric';
      name: string;
      targetValue: number;
      unit: string;
      frequency?: 'daily' | 'weekly' | 'monthly';
      trackingType?: 'quantity' | 'count' | 'duration' | 'distance' | 'boolean' | 'rating';
      category?: string;
      icon?: string;
    }
  | {
      action: 'update_metric';
      metricId?: number;
      metricName?: string;
      changes: {
        name?: string;
        targetValue?: number;
        unit?: string;
        frequency?: 'daily' | 'weekly' | 'monthly';
        trackingType?: 'quantity' | 'count' | 'duration' | 'distance' | 'boolean' | 'rating';
        category?: string;
        icon?: string;
        enabled?: boolean;
      };
    }
  | {
      action: 'log_metric_progress';
      metricId?: number;
      metricName?: string;
      value?: number;
      unit?: string;
      isCompleted?: boolean;
      date?: string;
      note?: string;
    }
  | {
      action: 'get_plan';
      date?: string;
      metricName?: string;
    }
  | {
      action: 'delete_metric';
      metricId?: number;
      metricName?: string;
      deleteAction?: 'archive' | 'disable';
    };

export interface UnsupportedIntentMatch {
  category: 'vitals' | 'medical' | 'general';
  message: string;
}

/**
 * Detects whether the user or model is requesting an unsupported wellness capability
 * (e.g. biometric sensors like blood pressure, ECG, glucose that the device cannot measure).
 */
export function detectUnsupportedIntent(
  userInput: string,
  modelAction?: string,
  _modelItems?: Array<{ food?: string }>
): UnsupportedIntentMatch | null {
  const normalizedInput = (userInput || '').trim().toLowerCase();
  const normalizedAction = (modelAction || '').trim().toLowerCase();

  const hasWord = (word: string) =>
    new RegExp(`\\b${word}\\b`, 'i').test(normalizedInput);

  // 1. Vitals & Biometrics (Heart rate, Blood pressure, SpO2, ECG, Glucose, Pulse)
  if (
    normalizedAction === 'get_heart_rate' ||
    normalizedAction === 'log_vitals' ||
    normalizedAction === 'heart_rate' ||
    normalizedAction === 'blood_pressure' ||
    hasWord('heart rate') ||
    hasWord('pulse') ||
    hasWord('blood pressure') ||
    hasWord('spo2') ||
    hasWord('ecg') ||
    hasWord('glucose') ||
    hasWord('blood sugar')
  ) {
    return {
      category: 'vitals',
      message:
        "I can manage your wellness goals, food logs, steps, and plan items. I don't currently have a direct tool for blood-pressure tracking.",
    };
  }

  // 2. Medical diagnostics / Doctor appointments
  if (
    hasWord('diagnose') ||
    hasWord('diagnosis') ||
    hasWord('fever') ||
    hasWord('prescription') ||
    hasWord('doctor appointment')
  ) {
    return {
      category: 'medical',
      message:
        "I can manage your wellness goals, food logs, steps, and plan items. I don't currently have medical diagnostic tools.",
    };
  }

  // 3. Unrecognized action from model output (not any of our supported actions)
  const recognizedActions = [
    'log_food',
    'get_steps',
    'get_summary',
    'create_metric',
    'update_metric',
    'log_metric_progress',
    'complete_metric',
    'get_plan',
    'delete_metric',
  ];
  if (normalizedAction && !recognizedActions.includes(normalizedAction)) {
    const formattedAction = normalizedAction
      .replace(/^(?:log_|track_|get_)/i, '')
      .replace(/_/g, ' ');
    return {
      category: 'general',
      message: `I understand you want to track ${formattedAction}. That capability isn't available in my current tools yet. I can manage your wellness goals, food logs, steps, and plan items.`,
    };
  }

  return null;
}

/**
 * Deterministically parse natural language commands for Plan control, Steps, Summary, and Food.
 */
export function parseNaturalLanguageIntent(rawInput: string): WellnessIntent | null {
  const norm = rawInput.trim().replace(/[.,!?;]+$/, '');
  const lower = norm.toLowerCase();

  // 1. Get Plan inquiry
  if (
    /what\s+(?:do\s+i\s+have\s+planned|are\s+my\s+(?:goals|tasks|plan))/i.test(lower) ||
    /show\s+(?:my\s+)?(?:plan|goals|tasks)/i.test(lower) ||
    /view\s+(?:my\s+)?(?:plan|goals)/i.test(lower) ||
    /what\s+have\s+i\s+completed/i.test(lower)
  ) {
    const metricMatch = lower.match(
      /how\s+much\s+(.*?)\s+(?:do\s+i\s+still\s+need|is\s+left|remaining)/i
    );
    const dateMatch = lower.match(/\b(tomorrow|yesterday|today)\b/i);
    return {
      action: 'get_plan',
      metricName: metricMatch ? metricMatch[1].trim() : undefined,
      date: dateMatch ? dateMatch[1].toLowerCase() : undefined,
    };
  }

  if (/how\s+much\s+(.*?)\s+(?:do\s+i\s+still\s+need|is\s+left|remaining)/i.test(lower)) {
    const metricMatch = lower.match(
      /how\s+much\s+(.*?)\s+(?:do\s+i\s+still\s+need|is\s+left|remaining)/i
    );
    return {
      action: 'get_plan',
      metricName: metricMatch ? metricMatch[1].trim() : undefined,
    };
  }

  // 2. Disable / Archive / Delete metric
  if (/\b(?:disable)\s+(?:my\s+)?(.*?)(?:\s+goal|\s+target|\s+task)?$/i.test(lower)) {
    const m = lower.match(/\b(?:disable)\s+(?:my\s+)?(.*?)(?:\s+goal|\s+target|\s+task)?$/i);
    if (m && m[1].trim()) {
      return {
        action: 'delete_metric',
        metricName: m[1].replace(/\s+(?:goal|target|task)$/i, '').trim(),
        deleteAction: 'disable',
      };
    }
  }

  if (/\b(?:remove|delete|stop\s+tracking|archive)\s+(?:my\s+)?(.*?)(?:\s+goal|\s+target|\s+task)?$/i.test(lower)) {
    const m = lower.match(/\b(?:remove|delete|stop\s+tracking|archive)\s+(?:my\s+)?(.*?)(?:\s+goal|\s+target|\s+task)?$/i);
    if (m && m[1].trim()) {
      return {
        action: 'delete_metric',
        metricName: m[1].replace(/\s+(?:goal|target|task)$/i, '').trim(),
        deleteAction: 'archive',
      };
    }
  }

  // 3. Mark complete / Boolean progress
  if (
    /\bmark\s+(?:my\s+)?(.*?)(?:\s+task|\s+goal|\s+item)?\s+(?:as\s+)?(?:complete|completed|done|finished)\b/i.test(lower)
  ) {
    const m = lower.match(
      /\bmark\s+(?:my\s+)?(.*?)(?:\s+task|\s+goal|\s+item)?\s+(?:as\s+)?(?:complete|completed|done|finished)\b/i
    );
    if (m && m[1].trim()) {
      return {
        action: 'log_metric_progress',
        metricName: m[1].replace(/\s+(?:goal|target|task)$/i, '').trim(),
        isCompleted: true,
      };
    }
  }

  // 4. Update metric (Change my water goal to 3 liters, Change my protein goal to 140 grams)
  if (
    /\b(?:change|make|update)\s+(?:my\s+)?(.*?)\s*(?:goal|target|plan|task)?\s*(?:to|as)\s*([0-9.]+)\s*([a-z]+)?/i.test(lower)
  ) {
    const m = lower.match(
      /\b(?:change|make|update)\s+(?:my\s+)?(.*?)\s*(?:goal|target|plan|task)?\s*(?:to|as)\s*([0-9.]+)\s*([a-z]+)?/i
    );
    if (m && m[1].trim() && m[2]) {
      return {
        action: 'update_metric',
        metricName: m[1].trim(),
        changes: {
          targetValue: parseFloat(m[2]),
          unit: m[3] ? m[3].trim() : undefined,
        },
      };
    }
  }

  // 5. Progress logging with verbs (drank, studied, walked)
  if (/i\s+drank\s+([0-9.]+)\s*([a-z]+)?\s*(?:of\s+)?water/i.test(lower)) {
    const m = lower.match(/i\s+drank\s+([0-9.]+)\s*([a-z]+)?\s*(?:of\s+)?water/i);
    if (m && m[1]) {
      return {
        action: 'log_metric_progress',
        metricName: 'Water',
        value: parseFloat(m[1]),
        unit: m[2] ? m[2].trim() : 'l',
      };
    }
  }

  if (/i\s+studied\s+(.*?)\s+for\s+([0-9.]+)\s*([a-z]+)/i.test(lower)) {
    const m = lower.match(/i\s+studied\s+(.*?)\s+for\s+([0-9.]+)\s*([a-z]+)/i);
    if (m && m[1] && m[2]) {
      return {
        action: 'log_metric_progress',
        metricName: m[1].trim(),
        value: parseFloat(m[2]),
        unit: m[3] ? m[3].trim() : 'min',
      };
    }
  }

  if (/i\s+walked\s+([0-9.]+)\s*steps/i.test(lower)) {
    const m = lower.match(/i\s+walked\s+([0-9.]+)\s*steps/i);
    if (m && m[1]) {
      return {
        action: 'log_metric_progress',
        metricName: 'Steps',
        value: parseFloat(m[1]),
        unit: 'steps',
      };
    }
  }

  // 6. Steps sensor inquiry
  if (/show\s+(?:my\s+)?steps/i.test(lower) || /how\s+many\s+steps/i.test(lower)) {
    return { action: 'get_steps' };
  }

  // 7. Summary inquiry
  if (/(?:today's\s+summary|give\s+me\s+today's\s+summary|show\s+summary|daily\s+summary)/i.test(lower)) {
    return { action: 'get_summary' };
  }

  // 8. Create Metric (e.g. "Add a water goal of 2.5 liters daily", "Track 8000 steps every day", "Set my protein goal to 150 grams", "I want to drink 2.5 liters of water every day")
  if (/\b(?:add|create|track|set\s+up|start\s+tracking|new|set\s+my|i\s+want\s+to)\b/i.test(lower)) {
    const setMyMatch = lower.match(
      /set\s+(?:my\s+)?(.*?)\s+(?:goal|target)\s+to\s+([0-9.]+)\s*([a-z]+)?/i
    );
    if (setMyMatch && setMyMatch[1].trim() && setMyMatch[2]) {
      return {
        action: 'create_metric',
        name: setMyMatch[1].trim(),
        targetValue: parseFloat(setMyMatch[2]),
        unit: setMyMatch[3] ? setMyMatch[3].trim() : '',
        frequency: 'daily',
      };
    }

    const freqMatch = lower.match(
      /\b(daily|every\s*day|everyday|weekly|every\s*week|monthly|every\s*month)\b/i
    );
    const frequency = freqMatch
      ? freqMatch[1].includes('week')
        ? 'weekly'
        : freqMatch[1].includes('month')
        ? 'monthly'
        : 'daily'
      : 'daily';

    const numUnitMatch = lower.match(
      /([0-9.]+)\s*(liters?|l|ml|hours?|hrs?|min(?:utes?)?|g|grams?|kg|steps?|km|m)\b/i
    );
    const val = numUnitMatch ? parseFloat(numUnitMatch[1]) : 1;
    const unit = numUnitMatch ? numUnitMatch[2].trim() : '';

    let clean = lower
      .replace(/\b(?:add|create|track|set\s+up|start\s+tracking|new|i\s+want\s+to|drink|walk|work\s*out|sleep|consume)\b/gi, '')
      .replace(/\b(?:a|an|the|my)\b/gi, '')
      .replace(
        /\b(daily|every\s*day|everyday|weekly|every\s*week|monthly|every\s*month|tomorrow|today)\b/gi,
        ''
      )
      .replace(
        /([0-9.]+)\s*(liters?|l|ml|hours?|hrs?|min(?:utes?)?|g|grams?|kg|steps?|km|m)\b/gi,
        ''
      )
      .replace(/\b(?:goal|target|plan|task|for|of|to)\b/gi, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .trim();

    if (!clean) {
      if (unit.toLowerCase().includes('step') || lower.includes('walk') || lower.includes('step')) clean = 'Steps';
      else if (unit.toLowerCase().includes('l') || unit.toLowerCase().includes('ml') || lower.includes('water')) clean = 'Water';
      else if (lower.includes('sleep')) clean = 'Sleep';
      else if (lower.includes('work') || lower.includes('exercise')) clean = 'Workout';
      else if (lower.includes('protein')) clean = 'Protein';
      else clean = 'Goal';
    }

    const name =
      clean
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .trim() || 'Goal';

    let trackingType: 'quantity' | 'duration' | 'count' = 'quantity';
    if (
      unit === 'min' ||
      unit === 'mins' ||
      unit === 'minute' ||
      unit === 'minutes' ||
      unit === 'hours' ||
      unit === 'hour' ||
      unit === 'h' ||
      unit === 'hrs'
    ) {
      trackingType = 'duration';
    } else if (unit.includes('step')) {
      trackingType = 'count';
    }

    return {
      action: 'create_metric',
      name,
      targetValue: val,
      unit,
      frequency,
      trackingType,
    };
  }

  // 9. Food logging fallback (e.g. "I ate 50g moong dal")
  const foodMatch =
    rawInput.match(/(?:ate|had|eaten|eats?|eating|log\s+food)\s+([0-9.]+)\s*([a-z]+)?\s+(.+)/i) ||
    rawInput.match(/([0-9.]+)\s*([a-z]+)?\s+(?:of\s+)?([a-z\s]+)/i);
  if (foodMatch && foodMatch[1] && foodMatch[3]) {
    const qty = parseFloat(foodMatch[1]);
    const unit = foodMatch[2] ? foodMatch[2].trim() : 'g';
    const foodCandidate = foodMatch[3].replace(/[.,!?;]+$/, '').trim();
    if (!isNaN(qty) && isKnownFood(foodCandidate)) {
      return {
        action: 'log_food',
        items: [{ food: foodCandidate, quantity: qty, unit }],
      };
    }
  }

  return null;
}

function extractJson(output: string): string {
  const assistantMarker = 'assistant';
  const assistantIndex = output.lastIndexOf(assistantMarker);

  const searchTarget =
    assistantIndex !== -1
      ? output.slice(assistantIndex + assistantMarker.length)
      : output;

  const start = searchTarget.indexOf('{');
  const end = searchTarget.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in assistant output');
  }

  return searchTarget.slice(start, end + 1).trim();
}

export async function executeWellnessIntent(
  modelOutput: string,
  userInput: string = ''
): Promise<WellnessResult> {
  // 1. Early check for recognized unsupported intent (e.g. blood pressure, vitals)
  const earlyCheck = detectUnsupportedIntent(userInput);
  if (earlyCheck) {
    return {
      success: false,
      isUnsupportedIntent: true,
      action: 'unsupported',
      message: earlyCheck.message,
    };
  }

  // 2. Check if user input directly expresses a deterministic intent
  const naturalIntent = parseNaturalLanguageIntent(userInput);

  // 3. Extract JSON from model output if available
  let parsedJson: Record<string, unknown> | null = null;
  try {
    const jsonText = extractJson(modelOutput);
    parsedJson = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    // Model output did not contain JSON
  }

  // 4. Resolve intent: Prefer parsed JSON if valid, otherwise fallback to naturalIntent
  let action: string = '';
  let payload: unknown = null;

  if (
    parsedJson &&
    typeof parsedJson.action === 'string' &&
    [
      'log_food',
      'get_steps',
      'get_summary',
      'create_metric',
      'update_metric',
      'log_metric_progress',
      'complete_metric',
      'get_plan',
      'delete_metric',
    ].includes(parsedJson.action)
  ) {
    action = parsedJson.action;
    payload = parsedJson;
  } else if (naturalIntent) {
    action = naturalIntent.action;
    payload = naturalIntent;
  } else if (parsedJson && typeof parsedJson.action === 'string') {
    // Unsupported model action
    const actionCheck = detectUnsupportedIntent(userInput, parsedJson.action);
    return {
      success: false,
      isUnsupportedIntent: true,
      action: 'unsupported',
      message: actionCheck
        ? actionCheck.message
        : `I understand you want to track ${parsedJson.action}. That capability isn't available in my current tools yet.`,
    };
  } else {
    // Neither JSON nor recognized natural pattern
    const fallbackCheck = detectUnsupportedIntent(userInput);
    if (fallbackCheck) {
      return {
        success: false,
        isUnsupportedIntent: true,
        action: 'unsupported',
        message: fallbackCheck.message,
      };
    }

    return {
      success: false,
      isMalformedOutput: true,
      message:
        "I could not recognize this request. You can log food (e.g. 'I ate 50g moong dal'), manage your goals (e.g. 'Add a water goal of 2.5 liters daily'), check steps, or view today's plan.",
    };
  }

  // 5. Execute via validated tools in wellnessToolRegistry
  try {
    switch (action) {
      case 'create_metric': {
        const validated = CreateMetricInputSchema.parse(payload);
        return (await wellnessToolRegistry.execute(
          'create_metric',
          validated
        )) as WellnessResult;
      }

      case 'update_metric': {
        const validated = UpdateMetricInputSchema.parse(payload);
        return (await wellnessToolRegistry.execute(
          'update_metric',
          validated
        )) as WellnessResult;
      }

      case 'log_metric_progress':
      case 'complete_metric': {
        const validated = LogMetricProgressInputSchema.parse(payload);
        return (await wellnessToolRegistry.execute(
          'log_metric_progress',
          validated
        )) as WellnessResult;
      }

      case 'get_plan': {
        const validated = GetPlanInputSchema.parse(payload ?? {});
        return (await wellnessToolRegistry.execute(
          'get_plan',
          validated
        )) as WellnessResult;
      }

      case 'delete_metric': {
        const deletePayload = payload as any;
        const validated = DeleteMetricInputSchema.parse({
          metricId: deletePayload?.metricId,
          metricName: deletePayload?.metricName,
          action: deletePayload?.deleteAction ?? deletePayload?.action ?? 'archive',
        });
        return (await wellnessToolRegistry.execute(
          'delete_metric',
          validated
        )) as WellnessResult;
      }

      case 'log_food': {
        const rawItems =
          payload && typeof payload === 'object' && 'items' in payload
            ? (payload as any).items
            : [];
        const validated = LogFoodInputSchema.parse({ items: rawItems });
        return (await wellnessToolRegistry.execute(
          'log_food',
          validated
        )) as WellnessResult;
      }

      case 'get_steps': {
        return (await wellnessToolRegistry.execute(
          'get_steps',
          {}
        )) as WellnessResult;
      }

      case 'get_summary': {
        return (await wellnessToolRegistry.execute(
          'get_summary',
          {}
        )) as WellnessResult;
      }

      default:
        throw new Error(`Unrecognized action: ${action}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Operation failed';
    return {
      success: false,
      action,
      message: msg,
    };
  }
}
