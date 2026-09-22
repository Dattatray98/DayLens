import { useEffect, useState } from "react";
import ActivityTab from "./pages/ActivityTab";
import Home from "./pages/Home";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Settings from "./pages/Settings";
import Assistant from "./pages/Assistant";
import ModelSetupScreen, {
  type ModelSetupState,
} from "./Components/ModelSetup/ModelSetupScreen";
import { Wellness, type ModelSetupProgressPayload } from "./native/Wellness";

const App = () => {
  const [modelState, setModelState] = useState<ModelSetupState>({
    status: "preparing",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });

  useEffect(() => {
    let isMounted = true;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupModel = async () => {
      try {
        listenerHandle = await Wellness.addListener(
          "modelSetupProgress",
          (payload: ModelSetupProgressPayload) => {
            if (!isMounted) return;
            setModelState({
              status: payload.status,
              progress: payload.progress ?? 0,
              downloadedBytes: payload.downloadedBytes ?? 0,
              totalBytes: payload.totalBytes ?? 0,
              error: payload.error,
            });
          }
        );

        await Wellness.prepareQwenModel();
      } catch (err: unknown) {
        if (!isMounted) return;
        const errorMessage =
          err instanceof Error ? err.message : "Failed to initialize model setup";
        setModelState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    };

    setupModel();

    return () => {
      isMounted = false;
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  const handleRetry = async () => {
    setModelState({
      status: "preparing",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    });
    try {
      await Wellness.prepareQwenModel();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to retry model setup";
      setModelState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
    }
  };

  if (modelState.status !== "ready") {
    return (
      <ModelSetupScreen
        status={modelState.status}
        progress={modelState.progress}
        downloadedBytes={modelState.downloadedBytes}
        totalBytes={modelState.totalBytes}
        error={modelState.error}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" Component={Home} />
        <Route path="/assitsant" Component={Assistant} />
        <Route path="/activity" Component={ActivityTab} />
        <Route path="/settings" Component={Settings} />
      </Routes>
    </Router>
  );
};

export default App;