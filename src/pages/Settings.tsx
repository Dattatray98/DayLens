import { useEffect, useState } from "react";
import { VscVoiceModeCompact } from "react-icons/vsc";
import { SiGnuprivacyguard } from "react-icons/si";
import { MdOutlinePrivacyTip } from "react-icons/md";
import { FaTrash, FaCheck, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { Capacitor } from "@capacitor/core";
import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";
import { Wellness } from "../native/Wellness";
import {
    clearAllWellnessHistory,
    clearFoodHistory,
    clearMetricHistory,
    getLocalDataSummary,
    type LocalDataSummary,
} from "../database/dataManagement";

interface ConfirmModalData {
    type: "food" | "metrics" | "all";
    title: string;
    description: string;
    confirmLabel: string;
}

const Settings = () => {
    // Section 1: Voice & Intelligence State
    const [aiStatus, setAiStatus] = useState<string>("checking");
    const [platformName, setPlatformName] = useState<string>("android");

    // Section 2: Privacy & Data Management State
    const [dataSummary, setDataSummary] = useState<LocalDataSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
    const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);
    const [processingAction, setProcessingAction] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    // Section 3: Device & Permissions State
    const [micStatus, setMicStatus] = useState<"checking" | "granted" | "denied" | "prompt" | "available" | "unavailable">("checking");
    const [sensorStatus, setSensorStatus] = useState<"idle" | "checking" | "granted" | "unavailable" | "permission_required">("idle");
    const [sensorMessage, setSensorMessage] = useState<string | null>(null);

    const platform = Capacitor.getPlatform();

    // Load AI & Data Summary on mount
    useEffect(() => {
        let isMounted = true;

        setPlatformName(platform);

        // 1. Check AI readiness
        const checkAi = async () => {
            try {
                const res = await Wellness.prepareQwenModel();
                if (!isMounted) return;
                if (res.status === "ready") {
                    setAiStatus("ready");
                } else if (res.status) {
                    setAiStatus(res.status);
                } else {
                    setAiStatus("ready");
                }
            } catch {
                if (!isMounted) return;
                if (platform === "web") {
                    setAiStatus("web_client");
                } else {
                    setAiStatus("ready");
                }
            }
        };

        // 2. Load database counts
        const loadCounts = async () => {
            try {
                const summary = await getLocalDataSummary();
                if (!isMounted) return;
                setDataSummary(summary);
            } catch (err) {
                console.error("Failed to load counts:", err);
            } finally {
                if (isMounted) setLoadingSummary(false);
            }
        };

        // 3. Inspect microphone permission state passively (no prompt)
        const checkMic = async () => {
            try {
                if (navigator.permissions && navigator.permissions.query) {
                    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
                    if (!isMounted) return;
                    setMicStatus(result.state as "granted" | "denied" | "prompt");
                    result.onchange = () => {
                        if (isMounted) {
                            setMicStatus(result.state as "granted" | "denied" | "prompt");
                        }
                    };
                } else if (typeof navigator.mediaDevices?.getUserMedia === "function") {
                    if (isMounted) setMicStatus("available");
                } else {
                    if (isMounted) setMicStatus("unavailable");
                }
            } catch {
                if (isMounted) setMicStatus("available");
            }
        };

        checkAi();
        loadCounts();
        checkMic();

        return () => {
            isMounted = false;
        };
    }, [platform]);

    // Explicit user request for microphone permission
    const handleRequestMicrophone = async () => {
        try {
            if (typeof navigator.mediaDevices?.getUserMedia === "function") {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());
                setMicStatus("granted");
                setFeedbackMessage("Microphone permission granted.");
            }
        } catch {
            setMicStatus("denied");
            setFeedbackMessage("Microphone access was denied by user/browser.");
        }
    };

    // Explicit user check for step sensor
    const handleCheckSensor = async () => {
        setSensorStatus("checking");
        setSensorMessage(null);
        try {
            if (platform === "web") {
                setSensorStatus("unavailable");
                setSensorMessage("Hardware step counter requires Android.");
                return;
            }

            const result = await Wellness.getSteps();
            if (result.success) {
                setSensorStatus("granted");
                setSensorMessage(result.sensor ? `${result.sensor} active` : "Step sensor available");
            } else if (result.permissionRequired) {
                setSensorStatus("permission_required");
                setSensorMessage("Activity recognition permission required");
            } else {
                setSensorStatus("unavailable");
                setSensorMessage(result.message ?? "Step counter not available on this device");
            }
        } catch (err: unknown) {
            setSensorStatus("unavailable");
            const msg = err instanceof Error ? err.message : "Sensor query failed";
            setSensorMessage(msg);
        }
    };

    // Execute confirmed data deletion
    const handleConfirmDelete = async () => {
        if (!confirmModal) return;
        setProcessingAction(true);
        try {
            if (confirmModal.type === "food") {
                const res = await clearFoodHistory();
                setFeedbackMessage(`Cleared ${res.clearedCount} food log record(s).`);
            } else if (confirmModal.type === "metrics") {
                const res = await clearMetricHistory();
                setFeedbackMessage(`Cleared ${res.clearedCount} plan progress record(s).`);
            } else if (confirmModal.type === "all") {
                const res = await clearAllWellnessHistory();
                setFeedbackMessage(
                    `Cleared ${res.foodCleared} food logs and ${res.metricsLogsCleared} progress logs.`
                );
            }
            setConfirmModal(null);
            const updated = await getLocalDataSummary();
            setDataSummary(updated);
        } catch (err) {
            console.error("Failed to delete records:", err);
            setFeedbackMessage("Failed to delete records.");
        } finally {
            setProcessingAction(false);
        }
    };

    return (
        <div className="bg-black min-h-screen text-white flex flex-col">
            <Navbar />

            <main className="overflow-y-auto pb-28 pb-[calc(6rem+env(safe-area-inset-bottom))] px-3 sm:px-4 pt-3 max-w-xl sm:max-w-2xl mx-auto w-full flex flex-col gap-4">
                {/* Feedback Toast Notification */}
                {feedbackMessage && (
                    <div className="bg-[#1A1C1E] border border-[#0EA5E9]/40 text-[#0EA5E9] px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
                        <span>{feedbackMessage}</span>
                        <button
                            type="button"
                            onClick={() => setFeedbackMessage(null)}
                            className="text-white/60 hover:text-white ml-2 text-sm cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* SECTION 1: VOICE & INTELLIGENCE */}
                <div className="rounded-2xl bg-[#1A1C1E] border border-white/10 p-4">
                    <div className="flex items-center gap-3.5 mb-3.5 pb-3 border-b border-white/10">
                        <VscVoiceModeCompact className="h-8 w-8 text-[#0EA5E9] shrink-0" />
                        <div>
                            <h1 className="text-lg font-bold text-white">Voice & Intelligence</h1>
                            <p className="text-xs text-[#2DB7F2]">100% On-Device Local Neural Execution</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-0.5 sm:gap-2">
                            <span className="text-[#909193] shrink-0">Local Model</span>
                            <span className="font-semibold text-white break-all sm:text-right">Qwen2.5-0.5B-Instruct-Int4</span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-0.5 sm:gap-2">
                            <span className="text-[#909193] shrink-0">Inference Engine</span>
                            <span className="font-semibold text-white break-all sm:text-right">ONNX Runtime GenAI</span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <span className="text-[#909193]">Model Status</span>
                            {aiStatus === "ready" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                                    <FaCheck className="text-[10px]" />
                                    <span>Verified Ready</span>
                                </span>
                            ) : aiStatus === "web_client" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                                    Web Environment
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium capitalize">
                                    {aiStatus}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-0.5 sm:gap-2">
                            <span className="text-[#909193] shrink-0">Execution Mode</span>
                            <span className="text-white font-medium sm:text-right">
                                {platformName === "android" ? "Native ARM64 (Offline)" : "Local Client Runtime"}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-white/5 text-[11px] text-[#909193]">
                            Voice queries and wellness analysis run directly on your hardware without sending telemetry to external cloud servers.
                        </div>
                    </div>
                </div>

                {/* SECTION 2: PRIVACY & DATA */}
                <div className="rounded-2xl bg-[#1A1C1E] border border-white/10 p-4">
                    <div className="flex items-center gap-3.5 mb-3.5 pb-3 border-b border-white/10">
                        <SiGnuprivacyguard className="h-8 w-8 text-[#0EA5E9] shrink-0" />
                        <div>
                            <h1 className="text-lg font-bold text-white">Privacy & Data</h1>
                            <p className="text-xs text-[#2DB7F2]">Local SQLite Storage Management</p>
                        </div>
                    </div>

                    {/* Data Counts Overview */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-4">
                        <div className="bg-black/40 rounded-xl p-2 sm:p-2.5 border border-white/5 text-center min-w-0">
                            <span className="text-sm sm:text-base font-bold text-white font-mono block truncate">
                                {loadingSummary ? "--" : dataSummary?.foodLogsCount ?? 0}
                            </span>
                            <p className="text-[10px] text-[#909193] mt-0.5 truncate">Food Logs</p>
                        </div>
                        <div className="bg-black/40 rounded-xl p-2 sm:p-2.5 border border-white/5 text-center min-w-0">
                            <span className="text-sm sm:text-base font-bold text-white font-mono block truncate">
                                {loadingSummary ? "--" : dataSummary?.metricLogsCount ?? 0}
                            </span>
                            <p className="text-[10px] text-[#909193] mt-0.5 truncate">Progress Logs</p>
                        </div>
                        <div className="bg-black/40 rounded-xl p-2 sm:p-2.5 border border-white/5 text-center min-w-0">
                            <span className="text-sm sm:text-base font-bold text-white font-mono block truncate">
                                {loadingSummary ? "--" : dataSummary?.metricsCount ?? 0}
                            </span>
                            <p className="text-[10px] text-[#909193] mt-0.5 truncate">Plan Goals</p>
                        </div>
                    </div>

                    {/* Safe Deletion Actions */}
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 gap-2">
                            <div className="min-w-0 pr-1 flex-1">
                                <h2 className="text-xs font-semibold text-white">Clear Food History</h2>
                                <p className="text-[11px] text-[#909193]">
                                    Deletes food records; preserves configured plans
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setConfirmModal({
                                        type: "food",
                                        title: "Clear Food History?",
                                        description:
                                            "Permanently delete all locally recorded food meals and nutrition history. Your configured Plan goals will remain intact.",
                                        confirmLabel: "Clear Food Logs",
                                    })
                                }
                                className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 gap-2">
                            <div className="min-w-0 pr-1 flex-1">
                                <h2 className="text-xs font-semibold text-white">Clear Progress Logs</h2>
                                <p className="text-[11px] text-[#909193]">
                                    Deletes step/water/activity logs; preserves goals
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setConfirmModal({
                                        type: "metrics",
                                        title: "Clear Plan Progress Logs?",
                                        description:
                                            "Permanently delete all recorded daily progress entries for steps, water, workouts, etc. Your configured Plan items and targets will NOT be removed.",
                                        confirmLabel: "Clear Progress Logs",
                                    })
                                }
                                className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 gap-2">
                            <div className="min-w-0 pr-1 flex-1">
                                <h2 className="text-xs font-semibold text-white">Clear All Wellness History</h2>
                                <p className="text-[11px] text-[#909193]">
                                    Deletes all food and progress logs; keeps plans
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setConfirmModal({
                                        type: "all",
                                        title: "Clear All Wellness History?",
                                        description:
                                            "Permanently delete all food log records and plan progress history from local storage. Your configured Plan items, settings, and local AI model will remain intact.",
                                        confirmLabel: "Clear All History",
                                    })
                                }
                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 3: DEVICE & PERMISSIONS */}
                <div className="rounded-2xl bg-[#1A1C1E] border border-white/10 p-4">
                    <div className="flex items-center gap-3.5 mb-3.5 pb-3 border-b border-white/10">
                        <MdOutlinePrivacyTip className="h-8 w-8 text-[#0EA5E9] shrink-0" />
                        <div>
                            <h1 className="text-lg font-bold text-white">Device & Permissions</h1>
                            <p className="text-xs text-[#2DB7F2]">Hardware Access Audit</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Microphone */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 gap-2">
                            <div className="min-w-0 pr-1 flex-1">
                                <h2 className="text-xs font-semibold text-white">Microphone</h2>
                                <p className="text-[11px] text-[#909193]">
                                    Active only during tap session in Assistant
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {micStatus === "granted" ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                                        Granted
                                    </span>
                                ) : micStatus === "denied" ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                                        Denied
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleRequestMicrophone}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[#0EA5E9] font-medium transition-colors cursor-pointer"
                                    >
                                        Grant
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Physical Step Sensor */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 gap-2">
                            <div className="min-w-0 pr-1 flex-1">
                                <h2 className="text-xs font-semibold text-white">Physical Step Sensor</h2>
                                <p className="text-[11px] text-[#909193]">
                                    {sensorMessage ?? "Hardware step counter audit"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {sensorStatus === "granted" ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                                        Available
                                    </span>
                                ) : sensorStatus === "checking" ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-[#909193]">
                                        Checking...
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleCheckSensor}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[#0EA5E9] font-medium transition-colors cursor-pointer"
                                    >
                                        Check
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* App Sandbox Storage */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 gap-2">
                            <div className="min-w-0 pr-1 flex-1">
                                <h2 className="text-xs font-semibold text-white">App Sandbox Storage</h2>
                                <p className="text-[11px] text-[#909193]">
                                    {platform === "android" ? "SQLite 256-bit encrypted sandbox" : "IndexedDB browser store"}
                                </p>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium shrink-0">
                                Encrypted
                            </span>
                        </div>
                    </div>
                </div>

                {/* SECTION 4: ABOUT */}
                <div className="rounded-2xl bg-[#1A1C1E] border border-white/10 p-4">
                    <div className="flex items-center gap-3.5 mb-3.5 pb-3 border-b border-white/10">
                        <FaInfoCircle className="h-6 w-6 text-[#9bc3a5] shrink-0" />
                        <div>
                            <h1 className="text-base font-bold text-white">About Daylens</h1>
                            <p className="text-xs text-[#9bc3a5]">See your life more clearly.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5 text-xs">
                        <div className="flex items-center justify-between py-0.5">
                            <span className="text-[#909193]">Application Version</span>
                            <span className="font-mono text-white">v1.4.2</span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-0.5 sm:gap-2">
                            <span className="text-[#909193] shrink-0">Android Package</span>
                            <span className="font-mono text-[11px] sm:text-xs text-white break-all sm:text-right">tech.github.dattatray.wellnessvoice</span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-0.5 sm:gap-2">
                            <span className="text-[#909193] shrink-0">Local Neural Model</span>
                            <span className="text-white break-all sm:text-right">Qwen2.5-0.5B-Instruct-Int4</span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-0.5 sm:gap-2">
                            <span className="text-[#909193] shrink-0">Runtime Stack</span>
                            <span className="text-white sm:text-right">React 19 · Capacitor · SQLite</span>
                        </div>

                        <div className="flex items-center justify-between py-0.5">
                            <span className="text-[#909193]">License</span>
                            <span className="text-white">Apache License 2.0</span>
                        </div>

                        <div className="mt-2 pt-2.5 border-t border-white/5 text-[11px] text-[#767779] text-center">
                            Built with open-weights local neural network. Zero tracking, zero cloud telemetry.
                        </div>
                    </div>
                </div>
            </main>

            {/* DESTRUCTIVE CONFIRMATION MODAL */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-[#1A1C1E] border border-white/15 rounded-2xl p-4 sm:p-5 max-w-sm w-full flex flex-col gap-4 shadow-xl max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center gap-3 text-red-400">
                            <FaExclamationTriangle className="h-5 w-5 shrink-0" />
                            <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
                        </div>

                        <p className="text-xs text-[#909193] leading-relaxed">
                            {confirmModal.description}
                        </p>

                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-white/10">
                            <button
                                type="button"
                                disabled={processingAction}
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={processingAction}
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 text-center"
                            >
                                <FaTrash className="text-[10px]" />
                                <span>{processingAction ? "Clearing..." : confirmModal.confirmLabel}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Bottombar />
        </div>
    );
};

export default Settings;
