import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

const Steps = ({ percentage = 0, size = 110, color = "#4f46e5" }) => {


    const cleanPercentage = Math.min(Math.max(percentage, 0), 100)

    const data = [
        {
            name: 'Progress',
            value: cleanPercentage,
            fill: color, // The actual progress bar fill color
        },
    ];


    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="80%" // Controls the thickness of the ring
                    outerRadius="100%"
                    barSize={12}      // Thickness of the moving progress line
                    data={data}
                    startAngle={90}   // Starts drawing from the very top (12 o'clock)
                    endAngle={-270}  // Runs clockwise for a full 360-degree circle
                >
                    {/* Background Track Setup */}
                    <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                    />
                    {/* Foreground Progress Bar */}
                    <RadialBar
                        background={{ fill: '#f3f4f6' }} // Tailwind's gray-100 equivalent for the background track
                        dataKey="value"
                        cornerRadius={10} // Gives the progress bar rounded edges
                    />
                </RadialBarChart>
            </ResponsiveContainer>

            {/* Centered Content overlayed on top of the SVG */}
            <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#2DB7F2]">
                    {Math.round(cleanPercentage)}%
                </span>
            </div>
        </div>
    )
}

export default Steps;