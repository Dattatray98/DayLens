import { FaHome } from "react-icons/fa";
import { SiGoogleassistant } from "react-icons/si";
import { LuActivity } from "react-icons/lu";
import { IoSettings } from "react-icons/io5";

const Bottombar = () => {
    return (
        <div className="flex items-center justify-between bg-black px-5 fixed bottom-0 h-15 w-full">
            <FaHome className="text-white h-6 w-6"/>
            <SiGoogleassistant className="text-white h-6 w-6" />
            <LuActivity className="text-white h-6 w-6" />
            <IoSettings className="text-white h-6 w-6" />
        </div>
    )
}

export default Bottombar;