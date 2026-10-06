import { lazy, StrictMode, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";

import { EmbedApp } from "./EmbedApp";
import { readEmbedParams } from "./params";

// Loaded only for dashboard=card, so switch panels never download the card
// dashboard (Redux, XLSX export).
const CardEmbedApp = lazy(() => import("./CardEmbedApp"));

/**
 * Kept in its own module so main.tsx stays a three-line entry and the ReactDOM
 * bootstrap is not inlined into every embed chunk that mounts this tree.
 */
export function mount(container: Element): Root {
  const params = readEmbedParams();
  const root = createRoot(container);
  root.render(
    <StrictMode>
      {params.dashboard === "card" ? (
        <Suspense fallback={null}>
          <CardEmbedApp params={params} />
        </Suspense>
      ) : (
        <EmbedApp params={params} />
      )}
    </StrictMode>,
  );
  return root;
}
