import { useEffect, useState } from "react";
import Navbar from "../Components/Ui/Navbar";
import Bottombar from "../Components/Ui/botombar";
import {
    archiveMetric,
    createMetric,
    getPlanProgress,
    logMetric,
    updateMetric,
} from "../database/metricRepository";
import {
    METRIC_FREQUENCIES,
    METRIC_TRACKING_TYPES,
    type CreateMetricInput,
    type MetricFrequency,
    type MetricTrackingType,
    type PlanItemProgress,
    type UpdateMetricInput,
} from "../database/metrics";
import { FaPlus, FaCheck, FaTimes } from "react-icons/fa";
import { MdEdit, MdArchive } from "react-icons/md";
import { LuClipboardList } from "react-icons/lu";
import ConfirmDialog from "../Components/Common/ConfirmDialog";

const PRESET_ICONS = ["🚶", "💧", "🥗", "🥩", "🏋️", "😴", "🧘", "💊", "🍎", "🚴", "🏃", "📊"];

const DEFAULT_TEMPLATES = [
    { name: "Steps", icon: "🚶", category: "fitness", unit: "steps", targetValue: 8000, frequency: "daily" as MetricFrequency, trackingType: "quantity" as MetricTrackingType },
    { name: "Water", icon: "💧", category: "wellness", unit: "ml", targetValue: 2500, frequency: "daily" as MetricFrequency, trackingType: "quantity" as MetricTrackingType },
    { name: "Protein", icon: "🥩", category: "nutrition", unit: "g", targetValue: 140, frequency: "daily" as MetricFrequency, trackingType: "quantity" as MetricTrackingType },
    { name: "Workout", icon: "🏋️", category: "fitness", unit: "min", targetValue: 30, frequency: "daily" as MetricFrequency, trackingType: "duration" as MetricTrackingType },
    { name: "Sleep", icon: "😴", category: "wellness", unit: "hours", targetValue: 8, frequency: "daily" as MetricFrequency, trackingType: "duration" as MetricTrackingType },
];

const Plan = () => {
    const [planItems, setPlanItems] = useState<PlanItemProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter by frequency
    const [frequencyFilter, setFrequencyFilter] = useState<"daily" | "weekly" | "monthly" | "all">("daily");

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItem, setEditingItem] = useState<PlanItemProgress | null>(null);
    const [loggingItem, setLoggingItem] = useState<PlanItemProgress | null>(null);

    // Form states for Add / Edit
    const [formName, setFormName] = useState("");
    const [formIcon, setFormIcon] = useState("📊");
    const [formCategory, setFormCategory] = useState("custom");
    const [formUnit, setFormUnit] = useState("");
    const [formTarget, setFormTarget] = useState("");
    const [formFrequency, setFormFrequency] = useState<MetricFrequency>("daily");
    const [formTrackingType, setFormTrackingType] = useState<MetricTrackingType>("quantity");
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Form state for logging progress
    const [logAmount, setLogAmount] = useState("");
    const [logNote, setLogNote] = useState("");
    const [logSubmitting, setLogSubmitting] = useState(false);
    const [logError, setLogError] = useState<string | null>(null);

    // Show/hide disabled items section
    const [showDisabled, setShowDisabled] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState<number | null>(null);

    const loadPlan = async () => {
        try {
            setLoading(true);
            const items = await getPlanProgress();
            setPlanItems(items);
            setError(null);
        } catch (err) {
            console.error("Failed to load plan items:", err);
            setError("Unable to load your plan items.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlan();
    }, []);

    // Filter items according to active frequency tab
    const applicableItems = planItems.filter((item) => {
        if (frequencyFilter === "all") return true;
        return item.metric.frequency === frequencyFilter;
    });

    // Enabled vs Disabled items
    const enabledItems = applicableItems.filter((item) => item.metric.enabled);
    const disabledItems = applicableItems.filter((item) => !item.metric.enabled);

    // Overall completion calculation based strictly on active enabled targets
    const totalEnabled = enabledItems.length;
    const completedCount = enabledItems.filter((item) => item.isCompleted).length;
    const overallPercentage = totalEnabled > 0 ? Math.round((completedCount / totalEnabled) * 100) : 0;

    // Open Edit Modal with item data
    const openEditModal = (item: PlanItemProgress) => {
        setEditingItem(item);
        setFormName(item.metric.name);
        setFormIcon(item.metric.icon);
        setFormCategory(item.metric.category);
        setFormUnit(item.metric.unit);
        setFormTarget(String(item.metric.targetValue));
        setFormFrequency(item.metric.frequency);
        setFormTrackingType(item.metric.trackingType);
        setFormError(null);
    };

    // Reset Form
    const resetForm = () => {
        setFormName("");
        setFormIcon("📊");
        setFormCategory("custom");
        setFormUnit("");
        setFormTarget("");
        setFormFrequency("daily");
        setFormTrackingType("quantity");
        setFormError(null);
        setEditingItem(null);
    };

    // Handle Create Plan Item
    const handleCreatePlanItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = formName.trim();
        const unit = formUnit.trim();
        const targetValue = parseFloat(formTarget);

        if (!name) {
            setFormError("Name is required.");
            return;
        }
        if (!unit) {
            setFormError("Unit is required (e.g. steps, ml, g, min).");
            return;
        }
        if (isNaN(targetValue) || targetValue < 0) {
            setFormError("Target must be a non-negative number.");
            return;
        }

        try {
            setFormSubmitting(true);
            const input: CreateMetricInput = {
                name,
                icon: formIcon,
                category: formCategory.trim() || "custom",
                unit,
                targetValue,
                frequency: formFrequency,
                trackingType: formTrackingType,
                source: "manual",
            };
            await createMetric(input);
            setShowAddModal(false);
            resetForm();
            await loadPlan();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to create plan item.";
            setFormError(msg);
        } finally {
            setFormSubmitting(false);
        }
    };

    // Handle Edit Plan Item
    const handleUpdatePlanItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        const name = formName.trim();
        const unit = formUnit.trim();
        const targetValue = parseFloat(formTarget);

        if (!name) {
            setFormError("Name is required.");
            return;
        }
        if (!unit) {
            setFormError("Unit is required.");
            return;
        }
        if (isNaN(targetValue) || targetValue < 0) {
            setFormError("Target must be a non-negative number.");
            return;
        }

        try {
            setFormSubmitting(true);
            const input: UpdateMetricInput = {
                name,
                icon: formIcon,
                category: formCategory.trim() || "custom",
                unit,
                targetValue,
                frequency: formFrequency,
                trackingType: formTrackingType,
            };
            await updateMetric(editingItem.metric.id, input);
            setEditingItem(null);
            resetForm();
            await loadPlan();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to update plan item.";
            setFormError(msg);
        } finally {
            setFormSubmitting(false);
        }
    };

    // Handle Toggle Enabled/Disabled
    const handleToggleEnabled = async (item: PlanItemProgress) => {
        try {
            await updateMetric(item.metric.id, { enabled: !item.metric.enabled });
            await loadPlan();
        } catch (err) {
            console.error("Failed to toggle metric:", err);
        }
    };

    // Handle Archive
    const handleArchiveItem = async (id: number) => {
        setArchiveTarget(null);
        try {
            await archiveMetric(id);
            setEditingItem(null);
            await loadPlan();
        } catch (err) {
            console.error("Failed to archive metric:", err);
        }
    };

    // Handle Quick Starter Template
    const handleAddTemplate = async (template: typeof DEFAULT_TEMPLATES[0]) => {
        try {
            await createMetric(template);
            await loadPlan();
        } catch (err) {
            console.error("Failed to add template:", err);
        }
    };

    // Handle Quick Log Progress
    const handleLogProgress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loggingItem) return;

        const val = parseFloat(logAmount);
        if (isNaN(val) || val <= 0) {
            setLogError("Please enter a valid amount greater than 0.");
            return;
        }

        try {
            setLogSubmitting(true);
            await logMetric(loggingItem.metric.id, val, logNote.trim() || undefined);
            setLoggingItem(null);
            setLogAmount("");
            setLogNote("");
            setLogError(null);
            await loadPlan();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to log progress.";
            setLogError(msg);
        } finally {
            setLogSubmitting(false);
        }
    };

    return (
        <div className="relative bg-black min-h-screen text-white pb-28 pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <Navbar />

            <main className="max-w-xl sm:max-w-2xl mx-auto px-4 py-5 space-y-6">
                {/* 1. HEADER */}
                <header className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Today's Plan</h1>
                        <p className="text-xs sm:text-sm text-[#909193]">Your daily wellness targets</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            resetForm();
                            setShowAddModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284c7] active:scale-[0.98] text-white text-xs font-semibold px-3 sm:px-3.5 py-2 rounded-xl transition-all shadow-md shadow-cyan-900/30 cursor-pointer shrink-0"
                    >
                        <FaPlus className="h-3 w-3" />
                        <span>Add Plan</span>
                    </button>
                </header>

                {/* Frequency Selector */}
                <div className="flex gap-1 bg-[#17191C] p-1 rounded-xl border border-white/10 text-[11px] sm:text-xs">
                    {(["daily", "weekly", "monthly", "all"] as const).map((freq) => (
                        <button
                            key={freq}
                            type="button"
                            onClick={() => setFrequencyFilter(freq)}
                            className={`flex-1 py-1.5 px-1 rounded-lg font-medium capitalize transition-colors cursor-pointer text-center ${
                                frequencyFilter === freq
                                    ? "bg-[#0EA5E9] text-white shadow-sm"
                                    : "text-[#909193] hover:text-white"
                            }`}
                        >
                            {freq === "daily" ? (
                                <>
                                    <span>Daily</span>
                                    <span className="hidden sm:inline"> (Today)</span>
                                </>
                            ) : (
                                freq
                            )}
                        </button>
                    ))}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                        {error}
                    </div>
                )}

                {/* 2. OVERALL COMPLETION CARD */}
                <section className="bg-[#1b1d1f] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-lg">
                    <div className="bg-[#009ADA] blur-[120px] absolute -top-10 -right-10 h-36 w-36 opacity-30 pointer-events-none" />

                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div>
                            <span className="text-xs font-semibold text-[#909193] uppercase tracking-wider">
                                Overall Completion
                            </span>
                            <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                                {completedCount} / {totalEnabled} completed
                            </div>
                        </div>
                        <div className="text-3xl font-extrabold text-[#0EA5E9]">
                            {overallPercentage}%
                        </div>
                    </div>

                    {/* Prominent Progress Bar */}
                    <div className="w-full bg-[#26292d] h-3.5 rounded-full overflow-hidden p-0.5 relative z-10">
                        <div
                            className="bg-gradient-to-r from-[#009ADA] to-[#0EA5E9] h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${overallPercentage}%` }}
                        />
                    </div>
                </section>

                {/* 3. PLAN ITEM LIST */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-[#909193] uppercase tracking-wider">
                            Active Targets ({enabledItems.length})
                        </h2>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-sm text-[#909193] animate-pulse">
                            Loading targets...
                        </div>
                    ) : enabledItems.length === 0 ? (
                        <div className="bg-[#1b1d1f] border border-white/8 rounded-2xl p-6 text-center space-y-4">
                            <LuClipboardList className="h-10 w-10 text-[#909193] mx-auto opacity-50" />
                            <div>
                                <h3 className="text-base font-semibold text-white">No active targets found</h3>
                                <p className="text-xs text-[#909193] mt-1">
                                    {planItems.length === 0
                                        ? "Start by adding your first daily target below or tapping '+ Add Plan'."
                                        : "No enabled items for this frequency filter."}
                                </p>
                            </div>

                            {/* Quick Starter Templates on Fresh Install */}
                            {planItems.length === 0 && (
                                <div className="pt-2 border-t border-white/8">
                                    <p className="text-xs text-[#909193] mb-2 font-medium">Quick Start Templates:</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {DEFAULT_TEMPLATES.map((tmpl) => (
                                            <button
                                                key={tmpl.name}
                                                type="button"
                                                onClick={() => handleAddTemplate(tmpl)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white transition-colors cursor-pointer"
                                            >
                                                <span>{tmpl.icon}</span>
                                                <span>{tmpl.name} ({tmpl.targetValue.toLocaleString()} {tmpl.unit})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {enabledItems.map((item) => {
                                const isCompleted = item.isCompleted;
                                return (
                                    <div
                                        key={item.metric.id}
                                        className={`rounded-2xl border transition-all duration-200 p-4 relative overflow-hidden ${
                                            isCompleted
                                                ? "bg-[#181a1c]/70 border-white/8 opacity-80"
                                                : "bg-[#1b1d1f] border-white/12 shadow-sm"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            {/* Icon & Title */}
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <span className="text-xl sm:text-2xl flex items-center justify-center w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-white/5 border border-white/8 shrink-0">
                                                    {item.metric.icon || "📊"}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                                                            {item.metric.name}
                                                        </h3>
                                                        {isCompleted && (
                                                            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                                                                <FaCheck className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                                <span>Done</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-[#909193] mt-0.5 truncate">
                                                        {item.currentValue.toLocaleString()} / {item.targetValue.toLocaleString()} {item.metric.unit}
                                                        {item.metric.frequency !== "daily" && (
                                                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#909193] uppercase font-mono">
                                                                {item.metric.frequency}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLoggingItem(item);
                                                        setLogAmount("");
                                                        setLogNote("");
                                                        setLogError(null);
                                                    }}
                                                    className="px-2 sm:px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 active:scale-95 text-xs text-cyan-400 font-medium transition-colors cursor-pointer"
                                                    title="Log Progress"
                                                >
                                                    + Log
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(item)}
                                                    className="p-1 sm:p-1.5 rounded-lg text-[#909193] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                                    title="Edit Plan Item"
                                                    aria-label="Edit Plan Item"
                                                >
                                                    <MdEdit className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-3.5 space-y-1">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-[#909193] font-mono">
                                                    Progress
                                                </span>
                                                <span className={`font-semibold ${isCompleted ? "text-emerald-400" : "text-white"}`}>
                                                    {item.progressPercent}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-[#26292d] h-2.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                                                        isCompleted
                                                            ? "bg-emerald-500"
                                                            : "bg-gradient-to-r from-[#009ADA] to-[#0EA5E9]"
                                                    }`}
                                                    style={{ width: `${item.progressPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* 8. DISABLED / PAUSED ITEMS */}
                {disabledItems.length > 0 && (
                    <section className="pt-2 border-t border-white/8 space-y-3">
                        <button
                            type="button"
                            onClick={() => setShowDisabled((prev) => !prev)}
                            className="flex items-center justify-between w-full text-xs font-semibold text-[#909193] uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
                        >
                            <span>Paused / Disabled Targets ({disabledItems.length})</span>
                            <span>{showDisabled ? "Hide" : "Show"}</span>
                        </button>

                        {showDisabled && (
                            <div className="space-y-2">
                                {disabledItems.map((item) => (
                                    <div
                                        key={item.metric.id}
                                        className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/6 opacity-60 text-sm"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span>{item.metric.icon || "📊"}</span>
                                            <div>
                                                <span className="text-white font-medium">{item.metric.name}</span>
                                                <p className="text-xs text-[#909193]">
                                                    Target: {item.targetValue} {item.metric.unit} ({item.metric.frequency})
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleEnabled(item)}
                                            className="text-xs text-[#0EA5E9] hover:underline font-medium cursor-pointer"
                                        >
                                            Enable
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* --- ADD / CREATE MODAL --- */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-[#1b1d1f] border border-white/15 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-base sm:text-lg font-bold text-white">Add New Plan Item</h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="text-[#909193] hover:text-white p-1 cursor-pointer"
                            >
                                <FaTimes className="h-4 w-4" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreatePlanItem} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. Daily Steps, Water Intake"
                                    className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                />
                            </div>

                            {/* Preset Icon Selector */}
                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">Icon</label>
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {PRESET_ICONS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setFormIcon(emoji)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors cursor-pointer ${
                                                formIcon === emoji
                                                    ? "bg-[#0EA5E9] text-white"
                                                    : "bg-white/5 hover:bg-white/10 text-white"
                                            }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Target Value</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formTarget}
                                        onChange={(e) => setFormTarget(e.target.value)}
                                        placeholder="e.g. 8000"
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Unit</label>
                                    <input
                                        type="text"
                                        value={formUnit}
                                        onChange={(e) => setFormUnit(e.target.value)}
                                        placeholder="e.g. steps, ml, g, min"
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Frequency</label>
                                    <select
                                        value={formFrequency}
                                        onChange={(e) => setFormFrequency(e.target.value as MetricFrequency)}
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9] capitalize"
                                    >
                                        {METRIC_FREQUENCIES.map((f) => (
                                            <option key={f} value={f}>
                                                {f}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Tracking Type</label>
                                    <select
                                        value={formTrackingType}
                                        onChange={(e) => setFormTrackingType(e.target.value as MetricTrackingType)}
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9] capitalize"
                                    >
                                        {METRIC_TRACKING_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">Category</label>
                                <select
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value)}
                                    className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                >
                                    <option value="fitness">Fitness</option>
                                    <option value="nutrition">Nutrition</option>
                                    <option value="wellness">Wellness</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            <div className="flex gap-2.5 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/15 text-white hover:bg-white/5 font-medium transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formSubmitting}
                                    className="flex-1 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-[#0284c7] text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {formSubmitting ? "Saving..." : "Create Target"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EDIT MODAL --- */}
            {editingItem && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-[#1b1d1f] border border-white/15 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-base sm:text-lg font-bold text-white">Edit Plan Item</h3>
                            <button
                                type="button"
                                onClick={() => setEditingItem(null)}
                                className="text-[#909193] hover:text-white p-1 cursor-pointer"
                            >
                                <FaTimes className="h-4 w-4" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleUpdatePlanItem} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                />
                            </div>

                            {/* Preset Icon Selector */}
                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">Icon</label>
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {PRESET_ICONS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setFormIcon(emoji)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors cursor-pointer ${
                                                formIcon === emoji
                                                    ? "bg-[#0EA5E9] text-white"
                                                    : "bg-white/5 hover:bg-white/10 text-white"
                                            }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Target Value</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formTarget}
                                        onChange={(e) => setFormTarget(e.target.value)}
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Unit</label>
                                    <input
                                        type="text"
                                        value={formUnit}
                                        onChange={(e) => setFormUnit(e.target.value)}
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Frequency</label>
                                    <select
                                        value={formFrequency}
                                        onChange={(e) => setFormFrequency(e.target.value as MetricFrequency)}
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9] capitalize"
                                    >
                                        {METRIC_FREQUENCIES.map((f) => (
                                            <option key={f} value={f}>
                                                {f}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[#909193] mb-1 font-medium">Tracking Type</label>
                                    <select
                                        value={formTrackingType}
                                        onChange={(e) => setFormTrackingType(e.target.value as MetricTrackingType)}
                                        className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#0EA5E9] capitalize"
                                    >
                                        {METRIC_TRACKING_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Enable/Disable Toggle */}
                            <div className="pt-2 flex items-center justify-between border-t border-white/8">
                                <span className="text-[#909193] font-medium">Active in Daily Plan</span>
                                <button
                                    type="button"
                                    onClick={() => handleToggleEnabled(editingItem)}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                        editingItem.metric.enabled
                                            ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/40"
                                            : "bg-rose-600/30 text-rose-400 border border-rose-500/40"
                                    }`}
                                >
                                    {editingItem.metric.enabled ? "Enabled" : "Disabled"}
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setArchiveTarget(editingItem.metric.id)}
                                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 font-medium transition-colors cursor-pointer text-xs"
                                    title="Archive Plan Item"
                                >
                                    <MdArchive className="h-4 w-4" />
                                    <span>Archive</span>
                                </button>
                                <div className="flex gap-2 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setEditingItem(null)}
                                        className="flex-1 py-2.5 rounded-xl border border-white/15 text-white hover:bg-white/5 font-medium transition-colors cursor-pointer text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formSubmitting}
                                        className="flex-1 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-[#0284c7] text-white font-semibold transition-colors cursor-pointer disabled:opacity-50 text-xs"
                                    >
                                        {formSubmitting ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- QUICK LOG PROGRESS MODAL --- */}
            {loggingItem && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-[#1b1d1f] border border-white/15 rounded-2xl max-w-sm w-full p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{loggingItem.metric.icon}</span>
                                <h3 className="text-base font-bold text-white">Log {loggingItem.metric.name}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLoggingItem(null)}
                                className="text-[#909193] hover:text-white p-1 cursor-pointer"
                            >
                                <FaTimes className="h-4 w-4" />
                            </button>
                        </div>

                        {logError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                                {logError}
                            </div>
                        )}

                        <form onSubmit={handleLogProgress} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">
                                    Amount ({loggingItem.metric.unit})
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    autoFocus
                                    value={logAmount}
                                    onChange={(e) => setLogAmount(e.target.value)}
                                    placeholder={`e.g. ${loggingItem.metric.unit === "steps" ? "1000" : "250"}`}
                                    className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2.5 text-white text-base font-semibold focus:outline-none focus:border-[#0EA5E9]"
                                />
                            </div>

                            <div>
                                <label className="block text-[#909193] mb-1 font-medium">
                                    Optional Note
                                </label>
                                <input
                                    type="text"
                                    value={logNote}
                                    onChange={(e) => setLogNote(e.target.value)}
                                    placeholder="e.g. Afternoon walk, post-workout water"
                                    className="w-full bg-[#16181B] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#0EA5E9]"
                                />
                            </div>

                            <div className="flex gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setLoggingItem(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/15 text-white hover:bg-white/5 font-medium transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={logSubmitting}
                                    className="flex-1 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-[#0284c7] text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {logSubmitting ? "Saving..." : "Log Progress"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {archiveTarget !== null && <ConfirmDialog title="Archive plan item?" message="Historical logs will be preserved." confirmLabel="Archive" onCancel={() => setArchiveTarget(null)} onConfirm={() => void handleArchiveItem(archiveTarget)} />}
            <Bottombar />
        </div>
    );
};

export default Plan;
