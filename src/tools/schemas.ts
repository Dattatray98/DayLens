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
