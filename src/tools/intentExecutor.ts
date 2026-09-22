import { wellnessToolRegistry } from './registry';
import { LogFoodInputSchema } from './schemas';

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
    };

function extractJson(output: string): string {
  const assistantMarker = "assistant";

  const assistantIndex = output.lastIndexOf(assistantMarker);

  if (assistantIndex === -1) {
    throw new Error("Assistant response marker not found");
  }

  const assistantOutput = output.slice(
    assistantIndex + assistantMarker.length
  );

  const start = assistantOutput.indexOf("{");
  const end = assistantOutput.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in assistant output");
  }

  return assistantOutput.slice(start, end + 1).trim();
}

export async function executeWellnessIntent(
  modelOutput: string
) {
  const jsonText = extractJson(modelOutput);

  let intent: WellnessIntent;

  try {
    intent = JSON.parse(jsonText) as WellnessIntent;
  } catch {
    throw new Error('Model output contains invalid JSON');
  }

  switch (intent.action) {
    case 'log_food': {
      const validated = LogFoodInputSchema.parse({
        items: intent.items,
      });

      return wellnessToolRegistry.execute(
        'log_food',
        validated
      );
    }

    case 'get_steps':
      return wellnessToolRegistry.execute(
        'get_steps',
        {}
      );

    case 'get_summary':
      return wellnessToolRegistry.execute(
        'get_summary',
        {}
      );

    default:
      throw new Error(
        `Unsupported wellness action: ${
          (intent as { action: string }).action
        }`
      );
  }
}
