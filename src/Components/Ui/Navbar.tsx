import { FaBell } from "react-icons/fa";

const Navbar = () => {
    return (
        <nav className="h-15 flex justify-between items-center px-4 border-b border-white/15 bg-[#1A1C1E]">
            <h1 className="text-lg font-bold text-white">Home</h1>
            <div className="flex gap-5 items-center">
                <FaBell className="h-6 w-6 text-white"/>
                <div className=" rounded-full h-10 w-10 border border-white">
                </div>
            </div>
        </nav>
    )
}

export default Navbar;