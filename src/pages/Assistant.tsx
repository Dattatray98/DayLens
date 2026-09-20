import { useEffect, useRef, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";
import ReactMarkdown from "react-markdown";
import Navbar from "../Components/Ui/Navbar";
import Bottombar from "../Components/Ui/botombar";

interface MessageType {
    id: number;
    user: string;
    ai: string;
}

const Assistant = () => {
    const [message, setMessage] = useState<MessageType[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [input, setInput] = useState("");

    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Scroll to the latest message
    useEffect(() => {
        chatScrollRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [message]);

    // Load saved messages
    useEffect(() => {
        const savedMessages = localStorage.getItem("chat_History");

        if (savedMessages) {
            try {
                setMessage(JSON.parse(savedMessages));
            } catch {
                localStorage.removeItem("chat_History");
            }
        }

        setIsLoaded(true);
    }, []);

    // Save messages
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(
                "chat_History",
                JSON.stringify(message)
            );
        }
    }, [message, isLoaded]);

    const handleMessage = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setInput(event.target.value);
    };

    const handleAskAI = async () => {
        const userInput = input.trim();

        if (!userInput) return;

        const messageId = Date.now();

        // Add user message
        setMessage((prev) => [
            ...prev,
            {
                id: messageId,
                user: userInput,
                ai: "",
            },
        ]);

        setInput("");

        // Temporary AI response
        const res = "Hello, how are you?";

        // Add AI response
        setMessage((prev) =>
            prev.map((msg) =>
                msg.id === messageId
                    ? {
                          ...msg,
                          ai: res,
                      }
                    : msg
            )
        );
    };

    return (
        <div className="h-dvh bg-black text-white flex flex-col overflow-hidden">

            {/* Top Navbar */}
            <Navbar />

            <main className="flex-1 min-h-0 flex flex-col">

                {/* ================= CHAT AREA ================= */}
                <div className="flex-1 min-h-0 overflow-y-auto chat-container-scroll">
                    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">

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
                                                px-4
                                                py-2
                                                max-w-[85%]
                                                sm:max-w-[70%]
                                                break-words
                                            "
                                        >
                                            {item.user}
                                        </div>
                                    </div>
                                )}

                                {/* AI MESSAGE */}
                                {item.ai && (
                                    <div className="flex justify-start">
                                        <div
                                            className="
                                                border
                                                border-gray-600/30
                                                bg-zinc-950
                                                rounded-2xl
                                                rounded-bl-md
                                                px-4
                                                py-3
                                                max-w-[90%]
                                                sm:max-w-[80%]
                                                break-words
                                            "
                                        >
                                            <ReactMarkdown>
                                                {item.ai}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                            </div>
                        ))}

                        {/* Scroll target */}
                        <div ref={chatScrollRef} />

                    </div>
                </div>

                {/* ================= INPUT AREA ================= */}
                <div
                    className="
                        shrink-0
                        bg-black
                        border-t
                        border-zinc-800
                        px-3
                        pt-3
                        pb-20
                    "
                >
                    <div className="w-full max-w-3xl mx-auto flex items-center gap-2">

                        {/* INPUT */}
                        <div
                            className="
                                flex-1
                                border
                                border-gray-600
                                rounded-2xl
                                overflow-hidden
                            "
                        >
                            <input
                                type="text"
                                placeholder="What's on your mind?"
                                className="
                                    h-12
                                    sm:h-14
                                    w-full
                                    bg-transparent
                                    outline-none
                                    px-4
                                    text-sm
                                    sm:text-base
                                "
                                value={input}
                                onChange={handleMessage}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        handleAskAI();
                                    }
                                }}
                            />
                        </div>

                        {/* SEND BUTTON */}
                        <button
                            type="button"
                            onClick={handleAskAI}
                            disabled={!input.trim()}
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
            <Bottombar />

        </div>
    );
};

export default Assistant;