import { registerPlugin } from '@capacitor/core';

export interface WellnessPlugin {
  test(): Promise<{
    message: string;
    platform: string;
    native: boolean;
  }>;

  getSteps(): Promise<{
    success: boolean;
    steps?: number;
    sensor?: string;
    permissionRequired?: boolean;
    message?: string;
  }>;


  testOnnx(): Promise<{
    initialized: boolean;
    runtime: string;
    version: string;
  }>;

  testOnnxInference(): Promise<{
    success: boolean;
    operation: string;
    x: number;
    y: number;
    result: number;
  }>;

  testGenAi(): Promise<{
    success: boolean;
    output: string;
    runtime: 'ONNX Runtime GenAI';
  }>;

  testQwenGenAi(): Promise<{
    success: boolean;
    output: string;
    runtime: string;
    model: string;
  }>;

  testStructuredIntent(options: {
    input: string;
  }): Promise<{
    success: boolean;
    output: string;
    runtime: string;
    model: string;
  }>;
}

export const Wellness = registerPlugin<WellnessPlugin>('Wellness');
