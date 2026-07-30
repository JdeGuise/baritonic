import { Link, Route, Routes } from "react-router-dom";
import { ImportPage } from "./pages/ImportPage.tsx";
import { LibraryPage } from "./pages/LibraryPage.tsx";
import { SongPage } from "./pages/SongPage.tsx";

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        {/* The accent span would otherwise split the accessible name into
            "music - ui"; label it explicitly so it reads as one word. */}
        <Link to="/" className="brand" aria-label="music-ui">
          music<span className="sep" aria-hidden="true">-</span>ui
        </Link>
        <nav className="row">
          <Link to="/import" className="btn pri">
            Import
          </Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/songs/:id" element={<SongPage />} />
      </Routes>
    </div>
  );
}
