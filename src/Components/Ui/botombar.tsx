import { FaHome } from "react-icons/fa";
import { SiGoogleassistant } from "react-icons/si";
import { LuActivity } from "react-icons/lu";
import { IoSettings } from "react-icons/io5";


const bottomTabs = [
    { id: 1, label: "Home", icon: <FaHome  className="h-5 w-5"/> },
    { id: 2, label: "Assistant", icon: <SiGoogleassistant className="h-5 w-5"/> },
    { id: 3, label: "Activity", icon: <LuActivity className="h-5 w-5"/> },
    { id: 4, label: "Settings", icon:<IoSettings className="h-5 w-5"/>}
]

const Bottombar = () => {
    return (
        <div className="flex items-center justify-between border-t border-white/15 bg-black px-5 fixed bottom-0 h-15 w-full">
            {bottomTabs.map((item) => (
                <div key={item.id} className="text-white flex flex-col items-center justify-between">
                    {item.icon}
                    <p className="text-[13px]">{item.label}</p>
                </div>
            ))}
        </div>
    )
}

export default Bottombar;