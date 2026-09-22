import { logFoodTool } from './logFoodTool';
import { getStepsTool } from './stepsTool';
import { getSummaryTool } from './summaryTool';
import {
  createMetricTool,
  updateMetricTool,
  logMetricProgressTool,
  getPlanTool,
  deleteMetricTool,
} from './planTools';

export const wellnessTools = [
  logFoodTool,
  getStepsTool,
  getSummaryTool,
  createMetricTool,
  updateMetricTool,
  logMetricProgressTool,
  getPlanTool,
  deleteMetricTool,
];

export type WellnessAction =
  | 'log_food'
  | 'get_steps'
  | 'get_summary'
  | 'create_metric'
  | 'update_metric'
  | 'log_metric_progress'
  | 'complete_metric'
  | 'get_plan'
  | 'delete_metric';

export const wellnessToolRegistry = {
  log_food: logFoodTool,
  get_steps: getStepsTool,
  get_summary: getSummaryTool,
  create_metric: createMetricTool,
  update_metric: updateMetricTool,
  log_metric_progress: logMetricProgressTool,
  complete_metric: logMetricProgressTool,
  get_plan: getPlanTool,
  delete_metric: deleteMetricTool,

  async execute(
    action: WellnessAction,
    input: unknown
  ): Promise<unknown> {
    switch (action) {
      case 'log_food':
        return logFoodTool.invoke(input as any);

      case 'get_steps':
        return getStepsTool.invoke(input as any);

      case 'get_summary':
        return getSummaryTool.invoke(input as any);

      case 'create_metric':
        return createMetricTool.invoke(input as any);

      case 'update_metric':
        return updateMetricTool.invoke(input as any);

      case 'log_metric_progress':
      case 'complete_metric':
        return logMetricProgressTool.invoke(input as any);

      case 'get_plan':
        return getPlanTool.invoke(input as any);

      case 'delete_metric':
        return deleteMetricTool.invoke(input as any);

      default:
        throw new Error(`Unsupported wellness action: ${action}`);
    }
  },
};
