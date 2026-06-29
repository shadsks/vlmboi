import { createRoot } from "react-dom/client";
import "@fontsource-variable/space-grotesk";
import App from "./App.jsx";
import "./index.css";

// No StrictMode: avoids the dev-only double getUserMedia / double interval mount.
createRoot(document.getElementById("root")).render(<App />);
