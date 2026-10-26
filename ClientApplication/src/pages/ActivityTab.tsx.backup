import { FaFire } from "react-icons/fa";
import Steps from "../Components/charts/Steps";
import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";
import { RiPinDistanceFill } from "react-icons/ri";

import { FaWalking } from "react-icons/fa";
import { CiCalendar } from "react-icons/ci";
import { MdOutlineInsights } from "react-icons/md";

const ActivityTab = () => {
    return (
        <div className="bg-black relative overflow-y-auto pb-25 text-white">
            <Navbar />
            <main>
                <div className="py-3 px-4">
                    <div className="bg-[#1b1d1f] p-3 rounded-2xl relative overflow-hidden">
                        <div className="bg-[#009ADA] blur-[140px] absolute -top-10 -right-10 h-40 w-40 opacity-60 pointer-events-none"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="bg-black rounded-2xl px-4 py-1 ">Hardware counter : Live</h1>
                            <p className="text-[#009ADA] font-medium">68% of Goal</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="font-medium text-[#AAABAE] text-xl mb-2">Daily Movement</h1>
                                <div className="flex items-baseline gap-1"><p className="text-5xl font-medium">5183</p> <p className="text-lg font-medium text-[#AAABAE]">/ 8000 steps</p></div>
                                <p className="text-[#AAABAE] mt-2">Calm, Steady pacing this afternoon</p>
                            </div>
                            <div>
                                <Steps percentage={68} color="#2DB7F2" />
                            </div>
                        </div>
                        <div className="flex justify-between mt-7">
                            <div className="flex items-center gap-4  py-2 px-4 rounded-4xl bg-[#131415]">
                                <RiPinDistanceFill className="h-10 w-10 text-[#909193]" />
                                <div>
                                    <h1>Distance</h1>
                                    <p>3.8 km</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-2 px-4 rounded-4xl bg-[#131415]">
                                <FaFire className="h-10 w-10 text-[#909193]" />
                                <div>
                                    <h1>Active Burn</h1>
                                    <p>210 kcal</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className=" p-4">
                    <h1 className="text-xl font-medium mb-4">Key Matrics</h1>
                    <div className="flex justify-between">
                        <div className="px-3 py-2 rounded-2xl bg-[#1A1C1E]">
                            <div className="flex justify-between items-center">
                                <FaWalking className="text-[#007FB5] font-bold" />
                                <h1 className="text-[#007FB5] font-bold">+12%</h1>
                            </div>
                            <div>
                                <h1 className="text-3xl mt-3 font-medium">5,421</h1>
                                <p className="font-medium text-[#909193]">Steps</p>
                            </div>
                            <p className="text-sm text-[#909193]">vs Yesterday</p>
                        </div>

                        <div className="flex justify-between">
                            <div className="px-3 py-2 rounded-2xl bg-[#1A1C1E]">
                                <div className="flex justify-between items-center">
                                    <RiPinDistanceFill className="text-[#007FB5] font-bold" />
                                    <h1 className="text-[#007FB5] font-bold">Active</h1>
                                </div>
                                <div>
                                    <h1 className="text-3xl mt-3 font-medium">3.8 km</h1>
                                    <p className="font-medium text-[#909193]">Distance</p>
                                </div>
                                <p className="text-sm text-[#909193]">Est. 48 move</p>
                            </div>

                        </div>
                        <div className="flex justify-between">
                            <div className="px-3 py-2 rounded-2xl bg-[#1A1C1E]">
                                <div className="flex justify-between items-center">
                                    <FaFire className="text-[#007FB5] font-bold" />
                                    <h1 className="text-[#007FB5] font-bold">Brun</h1>
                                </div>
                                <div>
                                    <h1 className="text-3xl mt-3 font-medium">210</h1>
                                    <p className="font-medium text-[#909193]">Active kcal</p>
                                </div>
                                <p className="text-sm text-[#909193]">Target 340 kcal</p>
                            </div>

                        </div>
                    </div>
                </div>
                <div className="p-3">
                    <div className="rounded-2xl p-3
                     ">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-medium text-[#E2E2E5]">Weekly Activity</h1>
                                <p className="text-[#767779]">Mon-Sun : Avg 6840 Steps/day</p>
                            </div>
                            <CiCalendar className="h-11 w-11 bg-[#2F3133] rounded-full p-2" />
                        </div>

                    </div>

                </div>
                <div className="p-4">
                <div className="bg-[#1A1C1E] p-3 rounded-2xl flex justify-between items-center gap-5">
                    
                    <MdOutlineInsights className="h-15 w-24 bg-[#00344D] p-2 rounded-full" />
                    <div className="">
                        <h1 className="text-lg text-[#0EA5E9] font-bold">GENTLE INSIGHT</h1>
                        <h2 className="text-md text-[#AAABAE] ">You're 2,579 steps away from today's goal</h2>
                        <p className="text-[12px] text-[#909193]">A 25-minute evening walk will complete your daily target at an easy, regenerative pace.</p>
                    </div>
                </div>
                </div>
            </main>
            <Bottombar />
        </div>
    )
}


export default ActivityTab;