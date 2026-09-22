import { z } from 'zod';

export const FoodItemSchema = z.object({
  food: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const LogFoodInputSchema = z.object({
  items: z.array(FoodItemSchema).min(1),
});

export const GetStepsInputSchema = z.object({});

export const GetSummaryInputSchema = z.object({});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type LogFoodInput = z.infer<typeof LogFoodInputSchema>;

export const CreateMetricInputSchema = z.object({
  name: z.string().min(1),
  targetValue: z.number().nonnegative(),
  unit: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  trackingType: z
    .enum(['quantity', 'count', 'duration', 'distance', 'boolean', 'rating'])
    .default('quantity'),
  category: z.string().default('custom'),
  icon: z.string().default('📊'),
});
export type CreateMetricInputZod = z.infer<typeof CreateMetricInputSchema>;

export const UpdateMetricInputSchema = z.object({
  metricId: z.number().int().positive().optional(),
  metricName: z.string().min(1).optional(),
  changes: z.object({
    name: z.string().min(1).optional(),
    targetValue: z.number().nonnegative().optional(),
    unit: z.string().min(1).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    trackingType: z
      .enum(['quantity', 'count', 'duration', 'distance', 'boolean', 'rating'])
      .optional(),
    category: z.string().optional(),
    icon: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
});
export type UpdateMetricInputZod = z.infer<typeof UpdateMetricInputSchema>;

export const LogMetricProgressInputSchema = z.object({
  metricId: z.number().int().positive().optional(),
  metricName: z.string().min(1).optional(),
  value: z.number().optional(),
  unit: z.string().optional(),
  isCompleted: z.boolean().optional(),
  date: z.string().optional(),
  note: z.string().optional(),
});
export type LogMetricProgressInputZod = z.infer<typeof LogMetricProgressInputSchema>;

export const GetPlanInputSchema = z.object({
  date: z.string().optional(),
  metricName: z.string().optional(),
});
export type GetPlanInputZod = z.infer<typeof GetPlanInputSchema>;

export const DeleteMetricInputSchema = z.object({
  metricId: z.number().int().positive().optional(),
  metricName: z.string().min(1).optional(),
  action: z.enum(['archive', 'disable']).default('archive'),
});
export type DeleteMetricInputZod = z.infer<typeof DeleteMetricInputSchema>;
