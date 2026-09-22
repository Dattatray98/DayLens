import React from "react";
import { FaHome } from "react-icons/fa";
import { SiGoogleassistant } from "react-icons/si";
import { LuActivity, LuClipboardList } from "react-icons/lu";
import { IoSettings } from "react-icons/io5";
import { useLocation, useNavigate } from "react-router-dom";

export interface BottombarProps {
    hidden?: boolean;
}

interface NavItemConfig {
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS_LEFT: NavItemConfig[] = [
    { path: "/", label: "Home", icon: FaHome },
    { path: "/plan", label: "Plan", icon: LuClipboardList },
];

const NAV_ITEMS_RIGHT: NavItemConfig[] = [
    { path: "/activity", label: "Activity", icon: LuActivity },
    { path: "/settings", label: "Settings", icon: IoSettings },
];

export const Bottombar: React.FC<BottombarProps> = ({ hidden = false }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const isAssistantActive = location.pathname === "/assitsant";

    const renderStandardItem = (item: NavItemConfig) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
            <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className="w-full flex flex-col items-center justify-center py-1 transition-colors cursor-pointer select-none focus:outline-none group"
            >
                <div className="relative flex flex-col items-center justify-center">
                    <Icon
                        className={`h-5 w-5 transition-colors duration-150 ${
                            isActive
                                ? "text-[#0EA5E9]"
                                : "text-[#909193] group-hover:text-white"
                        }`}
                    />
                    <span
                        className={`text-[10px] sm:text-[11px] mt-0.5 tracking-tight transition-colors duration-150 ${
                            isActive
                                ? "text-[#0EA5E9] font-semibold"
                                : "text-[#909193] group-hover:text-white font-medium"
                        }`}
                    >
                        {item.label}
                    </span>
                    {/* Subtle active pip indicator */}
                    <span
                        className={`w-1 h-1 rounded-full mt-0.5 transition-all duration-150 ${
                            isActive ? "bg-[#0EA5E9] opacity-100" : "bg-transparent opacity-0"
                        }`}
                        aria-hidden="true"
                    />
                </div>
            </button>
        );
    };

    return (
        <nav
            aria-label="Bottom navigation"
            aria-hidden={hidden}
            className={`fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0E1012]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-in-out ${
                hidden ? "translate-y-full pointer-events-none" : "translate-y-0"
            }`}
        >
            <div className="relative max-w-md mx-auto h-16 grid grid-cols-5 items-center px-1 sm:px-2">
                {/* 1. Home */}
                {renderStandardItem(NAV_ITEMS_LEFT[0])}

                {/* 2. Plan */}
                {renderStandardItem(NAV_ITEMS_LEFT[1])}

                {/* 3. Assistant (Center Elevated Action) */}
                <div className="relative flex justify-center items-center">
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 z-10 flex flex-col items-center justify-center">
                        <button
                            type="button"
                            onClick={() => navigate("/assitsant")}
                            aria-label="Assistant"
                            aria-current={isAssistantActive ? "page" : undefined}
                            className="flex flex-col items-center justify-center cursor-pointer group focus:outline-none select-none"
                        >
                            <div
                                className={`relative flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-200 shadow-md ${
                                    isAssistantActive
                                        ? "bg-[#0EA5E9] border-[#38bdf8] text-white shadow-lg shadow-[#0EA5E9]/35 scale-105"
                                        : "bg-[#16181B] border-white/20 text-[#0EA5E9] hover:border-[#0EA5E9]/50 hover:bg-[#1f2226]"
                                }`}
                            >
                                <SiGoogleassistant className="h-6 w-6" />
                            </div>
                            <span
                                className={`text-[10px] sm:text-[11px] mt-0.5 tracking-tight transition-colors duration-150 ${
                                    isAssistantActive
                                        ? "text-[#0EA5E9] font-semibold"
                                        : "text-[#909193] group-hover:text-white font-medium"
                                }`}
                            >
                                Assistant
                            </span>
                            {/* Subtle active pip indicator for Assistant */}
                            <span
                                className={`w-1 h-1 rounded-full mt-0.5 transition-all duration-150 ${
                                    isAssistantActive ? "bg-[#0EA5E9] opacity-100" : "bg-transparent opacity-0"
                                }`}
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>

                {/* 4. Activity */}
                {renderStandardItem(NAV_ITEMS_RIGHT[0])}

                {/* 5. Settings */}
                {renderStandardItem(NAV_ITEMS_RIGHT[1])}
            </div>
        </nav>
    );
};

export default Bottombar;