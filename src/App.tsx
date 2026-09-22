import { useEffect, useState } from "react";
import ActivityTab from "./pages/ActivityTab";
import Home from "./pages/Home";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Settings from "./pages/Settings";
import Assistant from "./pages/Assistant";
import Plan from "./pages/Plan";
import ModelSetupScreen, {
  type ModelSetupState,
} from "./Components/ModelSetup/ModelSetupScreen";
import LogoStartupScreen from "./Components/Startup/LogoStartupScreen";
import { Wellness, type ModelSetupProgressPayload } from "./native/Wellness";
import { setGlobalModelStatus } from "./Components/Ui/modelStatus";

const STARTUP_MIN_DISPLAY_MS = 800;

const App = () => {
  const [modelState, setModelState] = useState<ModelSetupState>({
    status: "preparing",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });

  const [isInitialStartup, setIsInitialStartup] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    const startupStartTime = Date.now();

    const completeStartup = () => {
      const elapsed = Date.now() - startupStartTime;
      const remainingTime = Math.max(0, STARTUP_MIN_DISPLAY_MS - elapsed);
      setTimeout(() => {
        if (isMounted) {
          setIsInitialStartup(false);
        }
      }, remainingTime);
    };

    const setupModel = async () => {
      try {
        listenerHandle = await Wellness.addListener(
          "modelSetupProgress",
          (payload: ModelSetupProgressPayload) => {
            if (!isMounted) return;
            setGlobalModelStatus(payload.status);
            setModelState({
              status: payload.status,
              progress: payload.progress ?? 0,
              downloadedBytes: payload.downloadedBytes ?? 0,
              totalBytes: payload.totalBytes ?? 0,
              error: payload.error,
            });

            // If downloading or error requires user attention, exit logo startup immediately
            if (payload.status === "downloading" || payload.status === "error") {
              setIsInitialStartup(false);
            }
          }
        );

        const res = await Wellness.prepareQwenModel();
        if (res?.status === "ready" && isMounted) {
          setGlobalModelStatus("ready");
          setModelState({
            status: "ready",
            progress: 100,
            downloadedBytes: 0,
            totalBytes: 0,
          });
          completeStartup();
        } else if (isMounted) {
          // If not ready and not already handling an event, exit logo startup
          setIsInitialStartup(false);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setGlobalModelStatus("error");
        const errorMessage =
          err instanceof Error ? err.message : "Failed to initialize model setup";
        setModelState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
        setIsInitialStartup(false);
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
    setGlobalModelStatus("preparing");
    setModelState({
      status: "preparing",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    });
    try {
      const res = await Wellness.prepareQwenModel();
      if (res?.status === "ready") {
        setGlobalModelStatus("ready");
        setModelState({
          status: "ready",
          progress: 100,
          downloadedBytes: 0,
          totalBytes: 0,
        });
      }
    } catch (err: unknown) {
      setGlobalModelStatus("error");
      const errorMessage =
        err instanceof Error ? err.message : "Failed to retry model setup";
      setModelState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
    }
  };

  // 1. Initial Logo-Only Startup view
  if (
    isInitialStartup &&
    modelState.status !== "downloading" &&
    modelState.status !== "error"
  ) {
    return <LogoStartupScreen />;
  }

  // 2. Model Setup Screen (shown only if download, verification, or error recovery is required)
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

  // 3. Main Application (rendered when model and app readiness is confirmed)
  return (
    <Router>
      <Routes>
        <Route path="/" Component={Home} />
        <Route path="/plan" Component={Plan} />
        <Route path="/assitsant" Component={Assistant} />
        <Route path="/activity" Component={ActivityTab} />
        <Route path="/settings" Component={Settings} />
      </Routes>
    </Router>
  );
};

export default App;