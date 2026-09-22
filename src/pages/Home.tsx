import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";

import { FaBowlFood } from "react-icons/fa6";
import { FaWalking, FaFire, FaCheck, FaArrowRight } from "react-icons/fa";
import { LuClipboardList } from "react-icons/lu";
import { getPlanProgress } from "../database/metricRepository";
import { getTodaySummary, getTodayFoodLogs } from "../database/foodRepository";
import { Wellness } from "../native/Wellness";
import type { PlanItemProgress } from "../database/metrics";

interface FoodLog {
    id: number;
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
    timestamp: string;
}

interface TodaySummary {
    foodCount: number;
    calories: number;
    protein: number;
}

const DEFAULT_CALORIE_GOAL = 2500;
const DEFAULT_PROTEIN_GOAL = 140;

const Home = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [summary, setSummary] = useState<TodaySummary>({
        foodCount: 0,
        calories: 0,
        protein: 0,
    });

    const [recentLogs, setRecentLogs] = useState<FoodLog[]>([]);
    const [planItems, setPlanItems] = useState<PlanItemProgress[]>([]);
    const [loading, setLoading] = useState(true);

    // Live steps state from hardware sensor
    const [steps, setSteps] = useState<number | null>(null);
    const [stepsLoading, setStepsLoading] = useState(true);
    const [stepsSensorMsg, setStepsSensorMsg] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadHomeData = async () => {
            try {
                const [todaySummary, todayLogs, planData, stepsRes] = await Promise.all([
                    getTodaySummary().catch((err) => {
                        console.error("Failed to load today summary:", err);
                        return { date: "", foodCount: 0, calories: 0, protein: 0 };
                    }),
                    getTodayFoodLogs().catch((err) => {
                        console.error("Failed to load today food logs:", err);
                        return [];
                    }),
                    getPlanProgress().catch((err) => {
                        console.error("Failed to load plan progress for home:", err);
                        return [];
                    }),
                    Wellness.getSteps().catch((err) => {
                        console.warn("Failed to read steps:", err);
                        return { success: false as const, steps: undefined, sensor: undefined, message: "Sensor unavailable" };
                    }),
                ]);

                if (!isMounted) return;

                setSummary(todaySummary);
                setRecentLogs((todayLogs as FoodLog[]).slice(0, 3));
                setPlanItems(planData);

                if (stepsRes.success && "steps" in stepsRes && typeof stepsRes.steps === "number") {
                    setSteps(stepsRes.steps);
                    setStepsSensorMsg(stepsRes.sensor ?? "Hardware sensor");
                } else {
                    setSteps(null);
                    setStepsSensorMsg(stepsRes.message ?? "Sensor unavailable");
                }
            } catch (error) {
                console.error("Failed to load home data:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setStepsLoading(false);
                }
            }
        };

        loadHomeData();

        // Refresh whenever window gains focus or document becomes visible
        const handleRefresh = () => {
            if (document.visibilityState === "visible") {
                loadHomeData();
            }
        };

        window.addEventListener("focus", handleRefresh);
        document.addEventListener("visibilitychange", handleRefresh);

        return () => {
            isMounted = false;
            window.removeEventListener("focus", handleRefresh);
            document.removeEventListener("visibilitychange", handleRefresh);
        };
    }, [location.key]);

    // Dynamic targets: check if user configured calorie or protein goals in Plan
    const caloriePlanMetric = planItems.find(
        (item) => item.metric.enabled && /calorie/i.test(item.metric.name)
    );
    const proteinPlanMetric = planItems.find(
        (item) => item.metric.enabled && /protein/i.test(item.metric.name)
    );

    const calorieGoal = caloriePlanMetric?.targetValue ?? DEFAULT_CALORIE_GOAL;
    const proteinGoal = proteinPlanMetric?.targetValue ?? DEFAULT_PROTEIN_GOAL;

    const caloriePercentage = calorieGoal > 0
        ? Math.min(100, (summary.calories / calorieGoal) * 100)
        : 0;

    const proteinPercentage = proteinGoal > 0
        ? Math.min(100, (summary.protein / proteinGoal) * 100)
        : 0;

    const enabledPlanItems = planItems.filter((item) => item.metric.enabled);
    const totalEnabled = enabledPlanItems.length;
    const completedCount = enabledPlanItems.filter((item) => item.isCompleted).length;
    const overallPlanPercentage =
        totalEnabled > 0 ? Math.round((completedCount / totalEnabled) * 100) : 0;
    const previewItems = enabledPlanItems.slice(0, 4);

    return (
        <div className="relative bg-black min-h-screen flex flex-col">
            <Navbar />

            <main className="flex-1 overflow-y-auto pb-28 pb-[calc(6rem+env(safe-area-inset-bottom))]">
                <div className="w-full max-w-xl sm:max-w-2xl mx-auto flex flex-col">
                    {/* Overview Tab */}
                    <div className="p-4 flex flex-col gap-4">
                        <h1 className="text-xl sm:text-2xl text-white font-medium">
                            How are you feeling Today?
                        </h1>

                        <div className="bg-[#1b1d1f] overflow-hidden relative flex flex-col gap-6 justify-between rounded-2xl p-4">
                            <div className="bg-[#009ADA] blur-[140px] absolute -top-10 -right-10 h-40 w-40 opacity-60 pointer-events-none"></div>

                            <div className="flex justify-between items-center text-white">
                                <h2 className="font-semibold text-base sm:text-lg">Today's Overview</h2>
                                <p className="text-xs sm:text-sm text-[#909193]">
                                    {loading ? "Loading..." : "From local history"}
                                </p>
                            </div>

                            <div className="space-y-3">
                                {/* Calories */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2 items-center">
                                            <FaFire className="h-5 w-5 text-[#909193] shrink-0" />
                                            <h1 className="text-[#909193] text-base sm:text-lg">
                                                Calories
                                            </h1>
                                        </div>

                                        <p className="text-[#909193] text-xs sm:text-sm font-mono shrink-0">
                                            {summary.calories.toLocaleString(undefined, { maximumFractionDigits: 0 })} /{" "}
                                            {calorieGoal.toLocaleString()} Cal
                                        </p>
                                    </div>

                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-[#0EA5E9] h-full transition-all duration-300 ease-out rounded-full"
                                            style={{
                                                width: `${caloriePercentage}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Protein */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2 items-center">
                                            <FaFire className="h-5 w-5 text-[#909193] shrink-0" />
                                            <h1 className="text-[#909193] text-base sm:text-lg">
                                                Protein
                                            </h1>
                                        </div>

                                        <p className="text-[#909193] text-xs sm:text-sm font-mono shrink-0">
                                            {summary.protein.toFixed(1)} /{" "}
                                            {proteinGoal.toFixed(0)}g
                                        </p>
                                    </div>

                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-[#0EA5E9] h-full transition-all duration-300 ease-out rounded-full"
                                            style={{
                                                width: `${proteinPercentage}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Steps */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-3 items-center min-w-0 pr-2">
                                        <FaWalking className="bg-[#3B82F6] rounded-full h-9 w-9 p-2 shrink-0" />

                                        <div className="min-w-0">
                                            <h1 className="text-[#C6C6C9] font-bold text-sm sm:text-base">
                                                Steps
                                            </h1>
                                            <p className="text-[#909193] text-[11px] sm:text-[12px] truncate">
                                                {stepsLoading
                                                    ? "Querying sensor..."
                                                    : steps !== null
                                                    ? (stepsSensorMsg || "Hardware sensor")
                                                    : (stepsSensorMsg || "Sensor unavailable")}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-xl sm:text-2xl text-[#C6C6C9] font-bold font-mono">
                                            {stepsLoading
                                                ? "--"
                                                : steps !== null
                                                ? steps.toLocaleString()
                                                : "--"}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => navigate("/activity")}
                                            className="text-[#3B82F6] hover:text-[#60a5fa] text-xs sm:text-sm font-medium cursor-pointer"
                                        >
                                            Activity
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Today's Plan Preview */}
                    <div className="px-4 py-2">
                        <div className="bg-[#1b1d1f] border border-white/10 rounded-2xl p-4 flex flex-col gap-3.5">
                            {/* Header */}
                            <div className="flex flex-wrap items-baseline justify-between gap-1">
                                <div className="flex items-center gap-2">
                                    <LuClipboardList className="text-[#0EA5E9] h-5 w-5 shrink-0" />
                                    <h2 className="text-white text-base sm:text-lg font-medium">Today's Plan</h2>
                                </div>
                                {totalEnabled > 0 && (
                                    <span className="text-xs text-[#909193] font-medium text-right">
                                        {completedCount} / {totalEnabled} completed &middot; {overallPlanPercentage}%
                                    </span>
                                )}
                            </div>

                            {totalEnabled === 0 ? (
                                <div className="py-4 flex flex-col items-center justify-center text-center gap-3">
                                    <p className="text-[#909193] text-sm">No plan items yet.</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/plan")}
                                        className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284c7] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                                    >
                                        Create Plan
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Overall Progress Bar */}
                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-[#0EA5E9] h-full transition-all duration-300 ease-out rounded-full"
                                            style={{ width: `${overallPlanPercentage}%` }}
                                        />
                                    </div>

                                    {/* Preview Items (3–4 items) */}
                                    <div className="flex flex-col gap-2 pt-1">
                                        {previewItems.map((item) => (
                                            <div
                                                key={item.metric.id}
                                                className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 gap-2"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 pr-1 flex-1">
                                                    {item.isCompleted ? (
                                                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                            <FaCheck className="text-[9px]" />
                                                        </span>
                                                    ) : (
                                                        <span className="w-4 h-4 rounded-full border border-white/30 shrink-0" />
                                                    )}
                                                    <span className="text-base shrink-0 select-none">
                                                        {item.metric.icon}
                                                    </span>
                                                    <span
                                                        className={`text-xs sm:text-sm truncate ${
                                                            item.isCompleted
                                                                ? "text-white/70"
                                                                : "text-white"
                                                        }`}
                                                    >
                                                        {item.metric.name}
                                                    </span>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <span className="text-[11px] sm:text-xs text-[#909193] font-mono">
                                                        {item.metric.trackingType === "boolean"
                                                            ? item.isCompleted
                                                                ? "Done"
                                                                : "Pending"
                                                            : `${item.currentValue} / ${item.targetValue} ${item.metric.unit}`}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* View Plan Button */}
                                    <button
                                        type="button"
                                        onClick={() => navigate("/plan")}
                                        className="w-full mt-1 py-2 px-3 bg-white/5 hover:bg-white/10 active:bg-white/15 text-[#0EA5E9] hover:text-[#38bdf8] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <span>View Plan</span>
                                        <FaArrowRight className="text-[10px]" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Recent activities */}
                    <div className="py-2">
                        <div className="flex justify-between items-center px-4 py-2">
                            <h2 className="text-xl sm:text-2xl text-white font-medium">Recent</h2>
                            <p className="text-white/80 text-xs sm:text-sm">
                                {summary.foodCount} food item
                                {summary.foodCount === 1 ? "" : "s"} today
                            </p>
                        </div>

                        <div className="px-4">
                            {recentLogs.length === 0 ? (
                                <div className="border border-white/8 bg-[#1A1C1E] py-4 px-3 rounded-2xl mt-2">
                                    <p className="text-gray-400 text-xs sm:text-sm">
                                        No food logged today.
                                    </p>
                                </div>
                            ) : (
                                recentLogs.map((item) => (
                                    <div
                                        key={item.id}
                                        className="border border-white/8 bg-[#1A1C1E] py-2.5 px-3 flex items-center gap-3.5 rounded-2xl mt-3"
                                    >
                                        <FaBowlFood className="text-[#0EA5E9] h-6 w-6 shrink-0" />

                                        <div className="flex flex-col justify-center min-w-0 flex-1">
                                            <h1 className="text-white text-base sm:text-lg capitalize truncate">
                                                {item.food}
                                            </h1>

                                            <p className="text-gray-400 text-xs sm:text-sm break-words">
                                                {item.quantity} {item.unit} ·{" "}
                                                {item.calories.toFixed(0)} kcal ·{" "}
                                                {item.protein.toFixed(1)}g protein
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <Bottombar />
        </div>
    );
};

export default Home;
