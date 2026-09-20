
import ActivityTab from "./pages/ActivityTab";
import Home from "./pages/Home";
import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import Settings from "./pages/Settings";
import Assistant from "./pages/Assistant";


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" Component={Home} />
        <Route path="/assitsant" Component={Assistant} />
        <Route path="/activity" Component={ActivityTab} />
        <Route path="/settings" Component={Settings} />
      </Routes>
    </Router>
  )
}



export default App; 