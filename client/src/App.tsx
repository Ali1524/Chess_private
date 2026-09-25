import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CreateGamePage from "./pages/CreateGamePage";
import JoinGamePage from "./pages/JoinGamePage";
import GamePage from "./pages/GamePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateGamePage />} />
        <Route path="/join" element={<JoinGamePage />} />
        <Route path="/join/:code" element={<JoinGamePage />} />
        <Route path="/game/:roomId" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}
