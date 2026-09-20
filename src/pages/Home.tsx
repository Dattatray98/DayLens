import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";

import { SiGoogleassistant } from "react-icons/si";
import { FaBowlFood } from "react-icons/fa6";
import { FaWalking } from "react-icons/fa";
import { FaFire } from "react-icons/fa";
import { MdKeyboardVoice } from "react-icons/md";

const recent_data = [
    { id: 1, lable: "first meal", description: "this is the first meal of the day", icon: <FaBowlFood className="text-[#A6F04C] h-6 w-6" /> },
    { id: 2, lable: "second meal", description: "this is the second meal of the day", icon: <FaBowlFood className="text-[#A6F04C] h-6 w-6" /> },
    { id: 3, lable: "third meal", description: "this is the third meal of the day", icon: <FaBowlFood className="text-[#A6F04C] h-6 w-6" /> }
]


const Home = () => {
    return (
        <div className="relative">
            <Navbar />
            <main className="flex-1 overflow-y-auto pb-22">

                {/* Overview Tab */}
                <div className=" p-5 flex flex-col gap-4">
                    <h1 className="text-xl text-white font-medium">How are you feeling Today?</h1>
                    <div className="border border-white/30 flex flex-col gap-6 justify-between rounded-2xl p-4">
                        <div className="flex justify-between items-center text-white">
                            <h2 >Today's Overview</h2>
                            <p className="text-sm text-[#909193]">Updated 12m ago</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <FaFire className="h-5 w-5 text-[#909193]" />
                                        <h1 className="text-[#909193] text-lg">Calories</h1>
                                    </div>
                                    <p className="text-[#909193] text-sm">1,842/2,500 Cal</p>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-[#84E056] h-full transition-all duration-300 ease-out rounded-full"
                                        style={{ width: 180 }}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <FaFire className="h-5 w-5 text-[#909193]" />
                                        <h1 className="text-[#909193] text-lg">Protein</h1>
                                    </div>
                                    <p className="text-[#909193] text-sm">50/140g</p>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-[#84E056] h-full transition-all duration-300 ease-out rounded-full"
                                        style={{ width: 100 }}
                                    />
                                </div>
                            </div>

                        </div>
                        <div >
                            <div className="flex items-center justify-between">
                                <div className="flex gap-3 items-center">
                                    <FaWalking className="bg-[#84E056] rounded-full h-9 w-9 p-2" />
                                    <div>
                                        <h1 className="text-[#C6C6C9] font-bold">Steps</h1>
                                        <p className="text-[#909193] text-[12px]">Daily Goal : 8000</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-2xl text-[#C6C6C9] text-right font-bold">5,298</p>
                                    <p className="text-[#66C03A] font-medium ">68% Reached</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* wake the assistant */}
                <div className="p-5">
                    <div className="flex items-center gap-3">
                    <SiGoogleassistant className="text-white h-7     w-7 z-50 animate-pulse" />
                    <h1 className="text-lg text-[#DFE2ED] font-medium">AI Assistant tab</h1>
                    </div>
                    <div className="h-80 flex flex-col justify-center items-center gap-3">
                        <div className="h-30 w-30 rounded-full bg-[#84E056] blur-3xl absolute animate-pulse ">
                        </div>
                        <MdKeyboardVoice className="text-white h-10 w-10 z-50 animate-pulse" />
                        <h1 className="text-white animate-pulse">Start Conversation</h1>
                    </div>
                </div>

                {/* Recent activities */}
                <div className="py-2">
                    <div className="flex justify-between h-10 items-center px-3">
                        <h2 className="text-2xl text-white">Recent</h2>
                        <p className="text-white text-sm">View all</p>
                    </div>

                    <div className="px-3">
                        {recent_data.map((item) => (
                            <div key={item.id} className="border border-white/8 bg-[#1A1C1E] py-2 px-3 flex items-center gap-4 rounded-2xl mt-4  ">
                                {item.icon}
                                <div className="flex flex-col justify-center">
                                    <h1 className="text-white text-lg">{item.lable}</h1>
                                    <p className="text-gray-400 text-sm">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <Bottombar />
        </div>
    )
}


export default Home;