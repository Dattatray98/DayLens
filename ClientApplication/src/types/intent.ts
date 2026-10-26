export type WellnessAction =
  | 'log_food'
  | 'get_steps'
  | 'get_summary';

export interface LogFoodIntent {
  action: 'log_food';
  food: string;
  quantity: number;
  unit: string;
}

export interface GetStepsIntent {
  action: 'get_steps';
}

export interface GetSummaryIntent {
  action: 'get_summary';
}

export type WellnessIntent =
  | LogFoodIntent
  | GetStepsIntent
  | GetSummaryIntent;
