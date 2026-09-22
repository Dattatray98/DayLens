import { logFoodTool } from './logFoodTool';
import { getStepsTool } from './stepsTool';
import { getSummaryTool } from './summaryTool';

export const wellnessTools = [
  logFoodTool,
  getStepsTool,
  getSummaryTool,
];

export const wellnessToolRegistry = {
  log_food: logFoodTool,
  get_steps: getStepsTool,
  get_summary: getSummaryTool,

  async execute(
    action: 'log_food' | 'get_steps' | 'get_summary',
    input: unknown
  ): Promise<unknown> {
    switch (action) {
      case 'log_food':
        return logFoodTool.invoke(input as any);

      case 'get_steps':
        return getStepsTool.invoke(input as any);

      case 'get_summary':
        return getSummaryTool.invoke(input as any);
    }
  },
};
