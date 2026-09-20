import { VscVoiceModeCompact } from "react-icons/vsc";
import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";
import { SiGnuprivacyguard } from "react-icons/si";
import { MdOutlinePrivacyTip } from "react-icons/md";



const Settings = () => {
    return (
        <div className="bg-black">
            <Navbar />
            <main className="text-white overflow-y-auto pb-25">
                <div className="p-3">
                    <div className=" rounded-2xl bg-[#1A1C1E] ">
                        <div className="flex items-center px-4 py-2 gap-5">
                            <VscVoiceModeCompact className="h-9 w-9" />
                            <div className="">
                                <h1 className="text-xl font-bold">Voice & Intelligence</h1>
                                <p className="text-sm text-[#2DB7F2]">100% Natural Execution On-Device</p>
                            </div>
                        </div>
                        <div className="p-4">
                            <div>
                                <div className="">
                                    <h1 className="text-md font-bold">Hand-Free Audio Capture</h1>
                                    <p className="text-[12px] text-[#909193]">Tap-to-talk microphone wake mechanism</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-3">
                    <div className=" rounded-2xl bg-[#1A1C1E] ">
                        <div className="flex items-center px-4 py-2 gap-5">
                            <SiGnuprivacyguard className="h-9 w-9" />
                            <div className="">
                                <h1 className="text-xl font-bold">Privacy & Data</h1>
                                <p className="text-sm text-[#2DB7F2]">Zero tracking, zero cloud telemetry</p>
                            </div>
                        </div>
                        <div className="p-4">
                            <div>
                                <div className="">
                                    <h1 className="text-md font-bold">SQLite 256-bit Vault</h1>
                                    <p className="text-[12px] text-[#909193]">All logs stay in device storage</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-3">
                    <div className=" rounded-2xl bg-[#1A1C1E] ">
                        <div className="flex items-center px-4 py-2 gap-5">
                            <MdOutlinePrivacyTip className="h-9 w-9" />
                            <div className="">
                                <h1 className="text-xl font-bold">Device & Permissions</h1>
                                <p className="text-sm text-[#2DB7F2]">Hardware access audit</p>
                            </div>
                        </div>
                        <div className="p-4">
                            <div>
                                <div className="">
                                    <h1 className="text-md font-bold">Microphone</h1>
                                    <p className="text-[12px] text-[#909193]">Active only during tap session</p>
                                </div>
                            </div>
                        </div>
                         <div className="p-4">
                            <div>
                                <div className="">
                                    <h1 className="text-md font-bold">Physical Sensors</h1>
                                    <p className="text-[12px] text-[#909193]">Active only during tap session</p>
                                </div>
                            </div>
                        </div>
                         <div className="p-4">
                            <div>
                                <div className="">
                                    <h1 className="text-md font-bold">App sandbox</h1>
                                    <p className="text-[12px] text-[#909193]">Active only during tap session</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col text-center items-center mt-10 text-[#767779]">
                    <h1 className="text-sm">WellNess Voice v1.4.2</h1>
                    <p className="text-[10px]">Built with open-weights local weight. Zero tracking. Apache 2.0</p>
                </div>
            </main>
            <Bottombar />
        </div>
    )
}


export default Settings;