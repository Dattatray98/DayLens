import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { ModelSetupStatus } from '../Components/ModelSetup/ModelSetupScreen';

export interface ModelSetupProgressPayload {
  status: ModelSetupStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface WellnessPlugin {
  prepareQwenModel(): Promise<{
    started?: boolean;
    status?: string;
    progress?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    error?: string;
    message?: string;
  }>;

  addListener(
    eventName: 'modelSetupProgress',
    listenerFunc: (event: ModelSetupProgressPayload) => void
  ): Promise<PluginListenerHandle>;

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
