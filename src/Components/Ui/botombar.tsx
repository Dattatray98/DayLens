import { FaHome } from "react-icons/fa";
import { SiGoogleassistant } from "react-icons/si";
import { LuActivity } from "react-icons/lu";
import { IoSettings } from "react-icons/io5";
import { useLocation, useNavigate } from "react-router-dom";


const bottomTabs = [
    { id: 1, location: "/", label: "Home", icon: <FaHome className="h-5 w-5" /> },
    { id: 2, location: "/assitsant", label: "Assistant", icon: <SiGoogleassistant className="h-5 w-5" /> },
    { id: 3, location: "/activity", label: "Activity", icon: <LuActivity className="h-5 w-5" /> },
    { id: 4, location: "/settings", label: "Settings", icon: <IoSettings className="h-5 w-5" /> }
]

const Bottombar = () => {

    const location = useLocation();
    const navigate = useNavigate();

    console.log(location)

    return (
        <div className="flex items-center justify-between border-t border-white/15 bg-black px-5 fixed bottom-0 h-15 w-full">
            {bottomTabs.map((item) => (
                <div key={item.id} className={`flex flex-col items-center justify-between ${location.pathname === item.location ? "text-[#0EA5E9]" : "text-white"}`} onClick={() => navigate(item.location)}>
                    {item.icon}
                    <p className="text-[13px]">{item.label}</p>
                </div>
            ))}
        </div>
    )
}

export default Bottombar;