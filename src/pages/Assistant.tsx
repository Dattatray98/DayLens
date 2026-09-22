import { useEffect, useRef, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";
import { IoMic, IoMicOutline } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import Navbar from "../Components/Ui/Navbar";
import Bottombar from "../Components/Ui/botombar";
import { Wellness } from "../native/Wellness";
import { executeWellnessIntent, detectUnsupportedIntent } from "../tools/intentExecutor";
import { formatWellnessResult } from "../utils/formatWellnessResult";

interface MessageType {
    id: number;
    user: string;
    ai: string;
}

const Assistant = () => {
    // Lazily initialize messages directly from localStorage so history renders immediately on mount
    // Filter out any incomplete or corrupt items where ai is missing
    const [message, setMessage] = useState<MessageType[]>(() => {
        try {
            const savedMessages = localStorage.getItem("chat_History");
            if (savedMessages) {
                const parsed = JSON.parse(savedMessages);
                if (Array.isArray(parsed)) {
                    return parsed.filter(
                        (m): m is MessageType =>
                            Boolean(
                                m &&
                                typeof m.id === "number" &&
                                typeof m.user === "string" &&
                                typeof m.ai === "string" &&
                                m.ai.trim().length > 0
                            )
                    );
                }
            }
        } catch (error) {
            console.error("Failed to load chat history from localStorage:", error);
            localStorage.removeItem("chat_History");
        }
        return [];
    });

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeMessageId, setActiveMessageId] = useState<number | null>(null);
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speechError, setSpeechError] = useState<string | null>(null);

    // Synchronous lock to prevent concurrent/rapid double submissions
    const isProcessingRef = useRef(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Helper to detect mobile touch device vs desktop mouse pointer
    const isTouchDevice = () => {
        if (typeof window === "undefined") return false;
        return (
            window.matchMedia("(pointer: coarse)").matches ||
            "ontouchstart" in window ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
        );
    };

    // Track viewport resize events (e.g. mobile virtual keyboard open/close)
    useEffect(() => {
        if (typeof window === "undefined" || !window.visualViewport) return;

        const handleViewportChange = () => {
            if (!window.visualViewport) return;
            // On mobile devices, virtual keyboard reduces visualViewport.height significantly
            const heightDiff = window.innerHeight - window.visualViewport.height;
            const keyboardActive = heightDiff > 120;
            setIsKeyboardOpen(keyboardActive);
        };

        window.visualViewport.addEventListener("resize", handleViewportChange);
        window.visualViewport.addEventListener("scroll", handleViewportChange);

        return () => {
            window.visualViewport?.removeEventListener("resize", handleViewportChange);
            window.visualViewport?.removeEventListener("scroll", handleViewportChange);
        };
    }, []);

    // Active keyboard state: on mobile touch devices, focus signals virtual keyboard
    const isKeyboardActive = isKeyboardOpen || (Boolean(isTouchDevice()) && isInputFocused);

    // Scroll to latest message when keyboard opens or messages update
    useEffect(() => {
        if (isKeyboardActive) {
            const timer = setTimeout(() => {
                chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [isKeyboardActive]);

    // Scroll to the latest message whenever messages update or loading state changes
    useEffect(() => {
        chatScrollRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [message, loading]);

    // Persist completed messages to localStorage whenever message state updates
    useEffect(() => {
        try {
            const completedMessages = message.filter(
                (m) => m && m.user && m.ai && m.ai.trim().length > 0
            );
            localStorage.setItem("chat_History", JSON.stringify(completedMessages));
        } catch (error) {
            console.error("Failed to save chat history to localStorage:", error);
        }
    }, [message]);

    const handleMessage = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setInput(event.target.value);
    };

    const handleAskAI = async (overrideInput?: string) => {
        const userInput = (overrideInput ?? input).trim();

        // Guard against empty input or already processing
        if (!userInput || isProcessingRef.current || loading) return;

        // Synchronously acquire lock
        isProcessingRef.current = true;
        const messageId = Date.now();

        // Add user message with empty ai response initially
        setMessage((prev) => [
            ...prev,
            {
                id: messageId,
                user: userInput,
                ai: "",
            },
        ]);

        setInput("");
        setActiveMessageId(messageId);
        setLoading(true);

        try {
            // 1. Early check for recognized unsupported intent (e.g. vitals/biometrics)
            const earlyUnsupported = detectUnsupportedIntent(userInput);
            if (earlyUnsupported) {
                setMessage((prev) =>
                    prev.map((msg) =>
                        msg.id === messageId
                            ? {
                                ...msg,
                                ai: earlyUnsupported.message,
                            }
                            : msg
                    )
                );
                return;
            }

            let modelOutput = "";
            try {
                const structuredResult =
                    await Wellness.testStructuredIntent({
                        input: userInput,
                    });
                if (structuredResult.success) {
                    modelOutput = structuredResult.output;
                }
            } catch (err) {
                console.warn("Native structured intent unavailable:", err);
            }

            const toolResult = await executeWellnessIntent(
                modelOutput,
                userInput
            );

            const formattedMessage = formatWellnessResult(toolResult);

            setMessage((prev) =>
                prev.map((msg) =>
                    msg.id === messageId
                        ? {
                            ...msg,
                            ai: formattedMessage,
                        }
                        : msg
                )
            );
        } catch (error) {
            console.error("AI error:", error);

            // Check if error matches an unsupported intent
            const unsupported = detectUnsupportedIntent(userInput);
            if (unsupported) {
                setMessage((prev) =>
                    prev.map((msg) =>
                        msg.id === messageId
                            ? {
                                ...msg,
                                ai: unsupported.message,
                            }
                            : msg
                    )
                );
                return;
            }

            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Something went wrong";

            setMessage((prev) =>
                prev.map((msg) =>
                    msg.id === messageId
                        ? {
                            ...msg,
                            ai: `**Unable to complete request**\n\n${errorMessage}`,
                        }
                        : msg
                )
            );
        } finally {
            // Guarantee all thinking and processing states are cleanly reset in all paths
            setLoading(false);
            setActiveMessageId(null);
            isProcessingRef.current = false;
        }
    };

    // Keep reference to latest handleAskAI for speechResult event callback
    const handleAskAIRef = useRef(handleAskAI);
    handleAskAIRef.current = handleAskAI;

    // Register native speech recognition listeners
    useEffect(() => {
        let isMounted = true;
        const cleanupListeners: (() => void)[] = [];

        (async () => {
            try {
                const hState = await Wellness.addListener("speechState", (data) => {
                    if (isMounted) {
                        setIsListening(data.state === "listening");
                    }
                });
                cleanupListeners.push(() => hState.remove());

                const hPartial = await Wellness.addListener("speechPartial", (data) => {
                    if (isMounted && data.text) {
                        setInput(data.text);
                    }
                });
                cleanupListeners.push(() => hPartial.remove());

                const hResult = await Wellness.addListener("speechResult", (data) => {
                    if (isMounted) {
                        setIsListening(false);
                        const finalText = data.text?.trim();
                        if (finalText) {
                            setInput(finalText);
                            handleAskAIRef.current(finalText);
                        }
                    }
                });
                cleanupListeners.push(() => hResult.remove());

                const hError = await Wellness.addListener("speechError", (data) => {
                    if (isMounted) {
                        setIsListening(false);
                        if (
                            data.error &&
                            data.error !== "No speech detected" &&
                            data.error !== "No speech recognized"
                        ) {
                            setSpeechError(data.error);
                            setTimeout(() => {
                                if (isMounted) setSpeechError(null);
                            }, 4000);
                        }
                    }
                });
                cleanupListeners.push(() => hError.remove());
            } catch (err) {
                console.warn("Speech recognition listener setup error:", err);
            }
        })();

        return () => {
            isMounted = false;
            cleanupListeners.forEach((cleanup) => cleanup());
            Wellness.stopListening().catch(() => {});
        };
    }, []);

    const handleToggleListening = async () => {
        if (loading) return;

        if (isListening) {
            try {
                await Wellness.stopListening();
            } catch (err) {
                console.warn("Failed to stop listening:", err);
            }
            setIsListening(false);
            return;
        }

        try {
            setSpeechError(null);
            const res = await Wellness.startListening();
            if (res.permissionRequired) {
                setSpeechError("Microphone permission required for voice input");
                setTimeout(() => setSpeechError(null), 4000);
            } else if (!res.success && res.error) {
                setSpeechError(res.error);
                setTimeout(() => setSpeechError(null), 4000);
            } else {
                setIsListening(true);
            }
        } catch (err) {
            console.warn("Failed to start listening:", err);
            setIsListening(false);
        }
    };

    return (
        <div className="h-dvh bg-black text-white flex flex-col overflow-hidden">
            {/* Top Navbar */}
            <Navbar />

            <main className="flex-1 min-h-0 flex flex-col">
                {/* ================= CHAT AREA ================= */}
                <div
                    className="flex-1 min-h-0 overflow-y-auto chat-container-scroll"
                    onTouchStart={() => {
                        if (isInputFocused) {
                            inputRef.current?.blur();
                        }
                    }}
                    onClick={() => {
                        if (isInputFocused) {
                            inputRef.current?.blur();
                        }
                    }}
                >
                    <div className="w-full max-w-3xl mx-auto px-3 sm:px-6">
                        {message.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col gap-3 py-3"
                            >
                                {/* USER MESSAGE */}
                                {item.user && (
                                    <div className="flex justify-end">
                                        <div
                                            className="
                                                bg-zinc-800
                                                rounded-2xl
                                                rounded-br-md
                                                px-3.5 sm:px-4
                                                py-2
                                                max-w-[88%]
                                                sm:max-w-[70%]
                                                break-words
                                                [overflow-wrap:anywhere]
                                                text-sm sm:text-base
                                            "
                                        >
                                            {item.user}
                                        </div>
                                    </div>
                                )}

                                {/* AI MESSAGE */}
                                {item.ai ? (
                                    <div className="flex justify-start">
                                        <div
                                            className="
                                                border
                                                border-gray-600/30
                                                bg-zinc-950
                                                rounded-2xl
                                                rounded-bl-md
                                                px-3.5 sm:px-4
                                                py-2.5 sm:py-3
                                                max-w-[92%]
                                                sm:max-w-[80%]
                                                break-words
                                                [overflow-wrap:anywhere]
                                                overflow-hidden
                                                text-sm sm:text-base
                                            "
                                        >
                                            <div className="break-words [&_pre]:overflow-x-auto [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:bg-black/50 [&_code]:break-all">
                                                <ReactMarkdown>
                                                    {item.ai}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                ) : loading && item.id === activeMessageId ? (
                                    <div className="flex justify-start">
                                        <div className="border border-gray-600/30 bg-zinc-950 rounded-2xl rounded-bl-md px-4 py-3 text-xs text-[#909193] animate-pulse">
                                            Thinking...
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ))}

                        {/* Scroll target */}
                        <div ref={chatScrollRef} />
                    </div>
                </div>

                {/* ================= INPUT AREA ================= */}
                <div
                    className={`
                        shrink-0
                        bg-black
                        border-t
                        border-zinc-800
                        px-3
                        pt-3
                        transition-[padding]
                        duration-200
                        ${
                            isKeyboardActive
                                ? "pb-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
                                : "pb-20 sm:pb-24 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
                        }
                    `}
                >
                    {/* Speech error indicator */}
                    {speechError && (
                        <div className="w-full max-w-3xl mx-auto mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs text-center">
                            {speechError}
                        </div>
                    )}

                    <div className="w-full max-w-3xl mx-auto flex items-center gap-2">
                        {/* INPUT */}
                        <div
                            className={`
                                flex-1
                                border
                                rounded-2xl
                                overflow-hidden
                                transition-colors
                                ${
                                    isListening
                                        ? "border-red-500/60 bg-red-500/5 shadow-sm shadow-red-500/10"
                                        : "border-gray-600 bg-transparent"
                                }
                            `}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={isListening ? "Listening... Speak now" : "What's on your mind?"}
                                className="
                                    h-12
                                    sm:h-14
                                    w-full
                                    bg-transparent
                                    outline-none
                                    px-3.5 sm:px-4
                                    text-sm
                                    sm:text-base
                                "
                                value={input}
                                onChange={handleMessage}
                                onFocus={() => setIsInputFocused(true)}
                                onBlur={() => setIsInputFocused(false)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleAskAI();
                                    }
                                }}
                            />
                        </div>

                        {/* MICROPHONE BUTTON */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleToggleListening}
                            disabled={loading}
                            aria-label={isListening ? "Stop listening" : "Start voice input"}
                            className={`
                                shrink-0
                                h-12
                                w-12
                                sm:h-14
                                sm:w-14
                                border
                                rounded-full
                                flex
                                items-center
                                justify-center
                                cursor-pointer
                                disabled:opacity-40
                                disabled:cursor-not-allowed
                                active:scale-95
                                transition-all
                                ${
                                    isListening
                                        ? "border-red-500 bg-red-500/20 text-red-400 shadow-md shadow-red-500/30 animate-pulse"
                                        : "border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                                }
                            `}
                        >
                            {isListening ? (
                                <IoMic className="h-5 w-5" />
                            ) : (
                                <IoMicOutline className="h-5 w-5" />
                            )}
                        </button>

                        {/* SEND BUTTON */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleAskAI()}
                            disabled={!input.trim() || loading || isListening}
                            aria-label="Send message"
                            className="
                                shrink-0
                                h-12
                                w-12
                                sm:h-14
                                sm:w-14
                                border
                                border-gray-600
                                rounded-full
                                flex
                                items-center
                                justify-center
                                cursor-pointer
                                disabled:opacity-40
                                disabled:cursor-not-allowed
                                active:scale-95
                                transition
                            "
                        >
                            <FaArrowUp className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </main>

            {/* Bottom Navigation */}
            <Bottombar hidden={isKeyboardActive} />
        </div>
    );
};

export default Assistant;
