import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Send from "./pages/Send";
import Explorer from "./pages/Explorer";
import Mine from "./pages/Mine";
import Network from "./pages/Network";

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/send"     element={<Send />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/mine"     element={<Mine />} />
            <Route path="/network"  element={<Network />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}