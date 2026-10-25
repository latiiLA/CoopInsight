import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "../app/store/store";

import "./index.css";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";

// Vite sets PROD from the build mode (npm run build), not a custom env key.
if (import.meta.env.PROD) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <Router>
      <Provider store={store}>
        <App />            
      </Provider>
      <Toaster/>
    </Router>
  </ThemeProvider>
);