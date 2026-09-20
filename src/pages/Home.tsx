import Bottombar from "../Components/Ui/botombar";
import Navbar from "../Components/Ui/Navbar";


const recent_data = [
    { id: 1, lable: "first meal", description: "this is the first meal of the day" },
    { id: 2, lable: "second meal", description: "this is the second meal of the day" },
    { id: 3, lable: "third meal", description: "this is the third meal of the day" }
]


const Home = () => {
    return (
        <div className="relative">
            <Navbar />
            <main>

                {/* Status Tab */}
                <div className=" p-5 flex flex-col gap-4">
                    <h1 className="text-xl text-white font-medium">How are you feeling Today?</h1>
                    <div className="border border-white/30 h-60 rounded-2xl">

                    </div>
                </div>

                {/* wake the assistant */}
                <div className=" border border-white h-80">

                </div>

                {/* Recent activities */}
                <div className="py-2">
                    <div className="flex justify-between h-10 items-center px-3">
                        <h2 className="text-2xl text-white">Recent</h2>
                        <p className="text-white text-sm">View all</p>
                    </div>
                
                    <div className="px-3">
                        {recent_data.map((item) => (
                            <div key={item.id} className="border border-white/30 h-20 flex flex-col justify-center px-3 rounded-2xl mt-4  ">
                                <h1 className="text-white text-lg">{item.lable}</h1>
                                <p className="text-gray-400 text-sm ">{item.description}</p>
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