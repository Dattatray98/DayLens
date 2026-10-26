import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaWalking, FaFire, FaUtensils, FaCheckCircle } from "react-icons/fa";
import { MdOutlineInsights } from "react-icons/md";
import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";
import { Wellness } from "../native/Wellness";
import {
    getActivityAnalysis,
    type ActivityAnalysisSummary,
    type AnalysisPeriod,
} from "../database/activityRepository";

const DAILY_STEP_GOAL = 8000;

const ActivityTab = () => {
    const navigate = useNavigate();

    // Period switcher state: "weekly" (default) or "monthly"
    const [period, setPeriod] = useState<AnalysisPeriod>("weekly");
    const [chartMetric, setChartMetric] = useState<"calories" | "protein">("calories");

    // Analysis data state
    const [analysis, setAnalysis] = useState<ActivityAnalysisSummary | null>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(true);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Preserved live hardware step state
    const [steps, setSteps] = useState<number | null>(null);
    const [stepsLoading, setStepsLoading] = useState(true);
    const [stepsSensorMsg, setStepsSensorMsg] = useState<string | null>(null);

    // Selected bar for details on tap
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Fetch analysis whenever period changes
    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                setLoadingAnalysis(true);
                const data = await getActivityAnalysis(period);
                if (!isMounted) return;
                setAnalysis(data);
                setAnalysisError(null);
            } catch (err: unknown) {
                if (!isMounted) return;
                console.error("Failed to load activity analysis:", err);
                setAnalysisError("Unable to load activity analysis.");
            } finally {
                if (isMounted) setLoadingAnalysis(false);
            }
        };

        load();

        return () => {
            isMounted = false;
        };
    }, [period]);

    // Query live hardware step counter (preserved functionality)
    useEffect(() => {
        let isMounted = true;

        const readSteps = async () => {
            try {
                const res = await Wellness.getSteps();
                if (!isMounted) return;
                if (res.success && typeof res.steps === "number") {
                    setSteps(res.steps);
                    setStepsSensorMsg(res.sensor ?? "Hardware sensor");
                } else {
                    setSteps(null);
                    setStepsSensorMsg(res.message ?? "Sensor unavailable");
                }
            } catch {
                if (!isMounted) return;
                setSteps(null);
                setStepsSensorMsg("Sensor query unavailable");
            } finally {
                if (isMounted) setStepsLoading(false);
            }
        };

        readSteps();

        return () => {
            isMounted = false;
        };
    }, []);

    const currentSteps = steps ?? 0;
    const stepPercentage = Math.min(
        100,
        Math.round((currentSteps / DAILY_STEP_GOAL) * 100)
    );

    // Max values for chart scaling
    const maxVal = analysis?.dailyData.reduce((acc, curr) => {
        const val = chartMetric === "calories" ? curr.calories : curr.protein;
        return Math.max(acc, val);
    }, 0) ?? 0;
    const safeMax = maxVal > 0 ? maxVal : chartMetric === "calories" ? 2500 : 140;

    const activePoint =
        analysis?.dailyData.find((p) => p.date === selectedDate) ??
        analysis?.dailyData.find((p) => p.isToday) ??
        analysis?.dailyData[analysis.dailyData.length - 1];

    return (
        <div className="bg-black min-h-screen text-white flex flex-col">
            <Navbar />

            <main className="flex-1 overflow-y-auto pb-28 px-4 pt-3 max-w-xl sm:max-w-2xl mx-auto w-full flex flex-col gap-4">
                {/* 1. PERIOD SWITCHER & RANGE HEADER */}
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-white">Activity Analysis</h1>

                        {/* Period Selector Tabs */}
                        <div className="flex bg-[#1A1C1E] border border-white/10 rounded-xl p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => setPeriod("weekly")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    period === "weekly"
                                        ? "bg-[#0EA5E9] text-white shadow-sm"
                                        : "text-[#909193] hover:text-white"
                                }`}
                            >
                                Weekly
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriod("monthly")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    period === "monthly"
                                        ? "bg-[#0EA5E9] text-white shadow-sm"
                                        : "text-[#909193] hover:text-white"
                                }`}
                            >
                                Monthly
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-[#2DB7F2] font-medium">
                        {analysis?.periodLabel ?? "Current Period"}
                    </p>
                </div>

                {/* 2. TODAY'S LIVE HARDWARE STEP COUNTER (PRESERVED) */}
                <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                        <div className="w-11 h-11 rounded-full bg-[#0EA5E9]/20 text-[#0EA5E9] flex items-center justify-center shrink-0">
                            <FaWalking className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-white">Today's Movement</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#909193] truncate max-w-[130px]">
                                    {stepsLoading ? "Reading..." : stepsSensorMsg}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-lg sm:text-xl font-bold text-white font-mono">
                                    {stepsLoading ? "--" : currentSteps.toLocaleString()}
                                </span>
                                <span className="text-xs text-[#909193]">/ {DAILY_STEP_GOAL} steps</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-[#0EA5E9]">{stepPercentage}%</span>
                        <p className="text-[10px] text-[#909193]">of goal</p>
                    </div>
                </div>

                {/* 3. PERIOD SUMMARY CARDS */}
                {loadingAnalysis ? (
                    <div className="py-12 text-center text-xs text-[#909193]">
                        Loading {period} analysis...
                    </div>
                ) : analysisError ? (
                    <div className="bg-[#1A1C1E] border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs">
                        {analysisError}
                    </div>
                ) : !analysis?.hasAnyData ? (
                    /* 4. EMPTY STATE */
                    <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#909193]">
                            <MdOutlineInsights className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">
                                No {period === "weekly" ? "Weekly" : "Monthly"} Activity Recorded
                            </h2>
                            <p className="text-xs text-[#909193] mt-1 max-w-xs">
                                Log your meals in Home or complete your wellness targets in Plan to see local activity trends and nutritional insights.
                            </p>
                        </div>
                        <div className="flex gap-2.5 mt-2">
                            <button
                                type="button"
                                onClick={() => navigate("/")}
                                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                            >
                                Log Meals
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/plan")}
                                className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284c7] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                            >
                                View Plan
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* 3 Summary Cards */}
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                            {/* Card 1: Consistency */}
                            <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between min-w-0">
                                <span className="text-[10px] sm:text-[11px] text-[#909193] truncate">Consistency</span>
                                <div className="mt-2 min-w-0">
                                    <span className="text-base sm:text-lg font-bold text-white font-mono block truncate">
                                        {analysis.consistencyPercentage}%
                                    </span>
                                    <p className="text-[9px] sm:text-[10px] text-[#909193] truncate">
                                        {analysis.totalTrackedDays}/{analysis.totalPeriodDays} days
                                    </p>
                                </div>
                            </div>

                            {/* Card 2: Calories */}
                            <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] sm:text-[11px] text-[#909193] truncate">Calories</span>
                                    <FaFire className="text-[#0EA5E9] text-xs shrink-0" />
                                </div>
                                <div className="mt-2 min-w-0">
                                    <span className="text-base sm:text-lg font-bold text-white font-mono block truncate">
                                        {analysis.totalCalories.toLocaleString()}
                                    </span>
                                    <p className="text-[9px] sm:text-[10px] text-[#909193] truncate">
                                        avg {analysis.avgCalories}/day
                                    </p>
                                </div>
                            </div>

                            {/* Card 3: Protein */}
                            <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] sm:text-[11px] text-[#909193] truncate">Protein</span>
                                    <FaUtensils className="text-[#38bdf8] text-xs shrink-0" />
                                </div>
                                <div className="mt-2 min-w-0">
                                    <span className="text-base sm:text-lg font-bold text-white font-mono block truncate">
                                        {analysis.totalProtein}g
                                    </span>
                                    <p className="text-[9px] sm:text-[10px] text-[#909193] truncate">
                                        avg {analysis.avgProtein}g/day
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 4. VISUAL TREND / BAR CHART */}
                        <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-bold text-white">Daily Intake Trend</h2>
                                    <p className="text-[11px] text-[#909193]">
                                        Tap any day to inspect details
                                    </p>
                                </div>

                                {/* Metric Switcher */}
                                <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => setChartMetric("calories")}
                                        className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                                            chartMetric === "calories"
                                                ? "bg-[#0EA5E9] text-white"
                                                : "text-[#909193] hover:text-white"
                                        }`}
                                    >
                                        Calories
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartMetric("protein")}
                                        className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                                            chartMetric === "protein"
                                                ? "bg-[#0EA5E9] text-white"
                                                : "text-[#909193] hover:text-white"
                                        }`}
                                    >
                                        Protein
                                    </button>
                                </div>
                            </div>

                            {/* Responsive Bar Chart Container */}
                            <div className="pt-4 pb-2 overflow-x-auto">
                                <div className={`h-36 flex items-end justify-between border-b border-white/10 pb-2 ${
                                    period === "monthly" ? "min-w-[480px] gap-1 px-1" : "w-full gap-1 sm:gap-2 px-1"
                                }`}>
                                    {analysis.dailyData.map((pt) => {
                                        const value =
                                            chartMetric === "calories" ? pt.calories : pt.protein;
                                        const heightPercent =
                                            safeMax > 0
                                                ? Math.max(value > 0 ? 8 : 2, Math.round((value / safeMax) * 100))
                                                : 2;
                                        const isSelected = activePoint?.date === pt.date;

                                        return (
                                            <button
                                                key={pt.date}
                                                type="button"
                                                onClick={() => setSelectedDate(pt.date)}
                                                className="flex-1 flex flex-col items-center gap-1 group cursor-pointer focus:outline-none h-full justify-end min-w-0"
                                                title={`${pt.dayLabel}: ${value} ${
                                                    chartMetric === "calories" ? "kcal" : "g"
                                                }`}
                                            >
                                                {/* Bar */}
                                                <div className="w-full flex justify-center items-end h-full">
                                                    <div
                                                        className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                                                            isSelected
                                                                ? "bg-[#38bdf8] ring-2 ring-[#0EA5E9]/50 shadow-md"
                                                                : value > 0
                                                                ? "bg-[#0EA5E9]/80 group-hover:bg-[#0EA5E9]"
                                                                : "bg-white/5"
                                                        }`}
                                                        style={{ height: `${heightPercent}%` }}
                                                    />
                                                </div>

                                                {/* Day Label */}
                                                <span
                                                    className={`text-[9px] sm:text-[10px] mt-1 font-mono transition-colors truncate block ${
                                                        pt.isToday
                                                            ? "text-[#0EA5E9] font-bold"
                                                            : isSelected
                                                            ? "text-white font-semibold"
                                                            : "text-[#909193]"
                                                    }`}
                                                >
                                                    {pt.shortDay}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Active Point Detail Bar */}
                                {activePoint && (
                                    <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-semibold text-white truncate">
                                                {activePoint.dayLabel}
                                                {activePoint.isToday && (
                                                    <span className="ml-1 text-[10px] text-[#0EA5E9]">(Today)</span>
                                                )}
                                            </span>
                                            <span className="text-[#909193]">·</span>
                                            <span className="text-[#909193] truncate">
                                                {activePoint.foodCount} meal{activePoint.foodCount === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2.5 font-mono text-[11px] sm:text-xs shrink-0">
                                            <span className="text-white font-medium">
                                                {activePoint.calories.toFixed(0)} kcal
                                            </span>
                                            <span className="text-[#38bdf8]">
                                                {activePoint.protein.toFixed(1)}g pro
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. FACTUAL INSIGHTS SECTION */}
                        <div className="bg-[#1A1C1E] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                                <MdOutlineInsights className="h-5 w-5 text-[#0EA5E9]" />
                                <h2 className="text-sm font-bold text-white">Factual Insights</h2>
                            </div>

                            <ul className="flex flex-col gap-2.5">
                                {analysis.insights.map((insight, idx) => (
                                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#C6C6C9]">
                                        <FaCheckCircle className="text-[#0EA5E9] text-[11px] mt-0.5 shrink-0" />
                                        <span className="leading-relaxed">{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </main>

            <Bottombar />
        </div>
    );
};

export default ActivityTab;
