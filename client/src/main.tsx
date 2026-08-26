import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { TERMINATORS_LOGO_IMAGE } from "@/components/terminators-logo";

document.querySelectorAll<HTMLLinkElement>('link[data-brand-icon]').forEach(link => {
  link.href = TERMINATORS_LOGO_IMAGE;
});

createRoot(document.getElementById("root")!).render(<App />);
