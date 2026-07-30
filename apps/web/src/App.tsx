import { Link, Route, Routes } from "react-router-dom";
import { ImportPage } from "./pages/ImportPage.tsx";
import { LibraryPage } from "./pages/LibraryPage.tsx";
import { SongPage } from "./pages/SongPage.tsx";
import { StagePage } from "./pages/StagePage.tsx";

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        {/* Accent the "tonic" half — it is the pun, and tonic is the real
            word for a key centre. The span would otherwise split the
            accessible name in two, so label it explicitly. */}
        <Link to="/" className="brand" aria-label="baritonic">
          bari<span className="sep">tonic</span>
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
        <Route path="/songs/:id/stage" element={<StagePage />} />
      </Routes>
    </div>
  );
}
