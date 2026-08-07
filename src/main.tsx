import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
// @ts-ignore - allow side-effect CSS import without type declarations
import "./index.css";
import App from "./App.tsx";

// Polyfill Buffer for Midnight SDK
globalThis.Buffer = globalThis.Buffer || Buffer;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
