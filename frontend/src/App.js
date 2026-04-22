import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Send from "./pages/Send";
import Explorer from "./pages/Explorer";

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/send" element={<Send />} />
                <Route path="/explorer" element={<Explorer />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;