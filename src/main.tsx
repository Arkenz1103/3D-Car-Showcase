import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

function RemoveBootScreen() {
  useEffect(() => {
    document.getElementById("boot-screen")?.remove();
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <RemoveBootScreen />
  </StrictMode>,
);
