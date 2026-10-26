import type { ModelSetupStatus } from "../ModelSetup/ModelSetupScreen";

let currentModelStatus: ModelSetupStatus = "ready";
const listeners = new Set<(status: ModelSetupStatus) => void>();

/**
 * Updates the global model setup status.
 * Called by App.tsx when model setup events are emitted.
 */
export const setGlobalModelStatus = (status: ModelSetupStatus) => {
    currentModelStatus = status;
    listeners.forEach((callback) => callback(status));
};

/**
 * Returns the current model setup status synchronously.
 */
export const getGlobalModelStatus = (): ModelSetupStatus => currentModelStatus;

/**
 * Subscribes to model status changes.
 */
export const subscribeModelStatus = (
    callback: (status: ModelSetupStatus) => void
): (() => void) => {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
};

