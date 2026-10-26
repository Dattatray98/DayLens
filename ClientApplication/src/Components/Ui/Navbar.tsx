import { useEffect, useRef, useState } from "react";
import type { ModelSetupStatus } from "../ModelSetup/ModelSetupScreen";
import {
    getGlobalModelStatus,
    subscribeModelStatus,
} from "./modelStatus";

const Navbar = () => {
    const [modelStatus, setModelStatus] = useState<ModelSetupStatus>(getGlobalModelStatus());
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to status updates from App.tsx without native calls
        const unsubscribe = subscribeModelStatus((status) => {
            setModelStatus(status);
        });

        // Dismiss tooltip on click outside
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setShowTooltip(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            unsubscribe();
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Status styling & label
    const getStatusConfig = () => {
        switch (modelStatus) {
            case "ready":
                return {
                    label: "Local AI",
                    dotClass: "bg-emerald-400",
                    badgeClass: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15",
                    tooltipText: "AI inference runs locally on this device.",
                };
            case "verifying":
                return {
                    label: "Verifying AI",
                    dotClass: "bg-amber-400 animate-pulse",
                    badgeClass: "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/15",
                    tooltipText: "Verifying local model integrity before execution.",
                };
            case "preparing":
            case "downloading":
                return {
                    label: "Preparing AI",
                    dotClass: "bg-amber-400 animate-pulse",
                    badgeClass: "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/15",
                    tooltipText: "Model setup requires an internet connection. Inference runs locally after setup.",
                };
            case "error":
            default:
                return {
                    label: "AI unavailable",
                    dotClass: "bg-red-400",
                    badgeClass: "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/15",
                    tooltipText: "Local model could not be verified on device.",
                };
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <header className="sticky top-0 z-40 h-13 sm:h-14 border-b border-white/10 bg-[#0E1012]/95 backdrop-blur-md px-4 flex items-center select-none">
            <div className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto flex items-center justify-between">
                {/* LEFT: Branding */}
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-[#0EA5E9]/15 border border-[#0EA5E9]/30 flex items-center justify-center">
                        <span className="text-[#0EA5E9] font-black text-[11px] leading-none">W</span>
                    </div>
                    <div className="flex items-center">
                        <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                            well<span className="text-[#0EA5E9]">Ness</span>
                        </span>
                        <span className="text-white/80 font-medium text-sm sm:text-base ml-1">
                            Voice
                        </span>
                    </div>
                </div>

                {/* RIGHT: Compact Local Processing Status Indicator */}
                <div className="relative" ref={tooltipRef}>
                    <button
                        type="button"
                        onClick={() => setShowTooltip((prev) => !prev)}
                        aria-label={`Local AI Status: ${statusConfig.label}`}
                        aria-expanded={showTooltip}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-all duration-150 ${statusConfig.badgeClass}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                        <span>{statusConfig.label}</span>
                    </button>

                    {/* Explanatory Popover Tooltip */}
                    {showTooltip && (
                        <div
                            role="tooltip"
                            className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] p-2.5 rounded-xl bg-[#1A1C1E] border border-white/15 shadow-xl text-[11px] text-white/90 z-50 animate-in fade-in zoom-in-95 duration-100"
                        >
                            <div className="flex items-start gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${statusConfig.dotClass}`} />
                                <p className="leading-relaxed">
                                    {statusConfig.tooltipText}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;