import { FaBell, FaPlus } from "react-icons/fa";
import { useLocation } from "react-router-dom";


const navTabs = [
    { id: 1, location: "/", label: "Home" },
    { id: 2, location: "/assitsant", label: "Assistant" },
    { id: 3, location: "/activity", label: "Activity" },
    { id: 4, location: "/settings", label: "Settings" }
]


const Navbar = () => {

    const location = useLocation();

    return (
        <nav className="h-15 flex justify-between items-center px-4 border-b border-white/15 bg-[#0E1012] text-white">

            {location.pathname && (
                <h1 className="text-lg font-bold text-white">{navTabs.find((tab) => tab.location === location.pathname)?.label}</h1>
            )}

            <div className="flex gap-5 items-center">
                <FaPlus className="h-6 w-6" />
                <FaBell className="h-6 w-6 text-white" />
                <div className=" rounded-full h-8 w-8 border  border-white text-white flex justify-center items-center text-xl font-bold">
                    J
                </div>
            </div>
        </nav>
    )
}

export default Navbar;