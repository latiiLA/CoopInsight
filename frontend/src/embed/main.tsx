import "../index.css";

import { mount } from "./bootstrap";

/**
 * Embed entry point.
 *
 * Deliberately independent of the admin app: no Redux store, no auth slice, no
 * <Layout>, so this bundle does not pull in the sidebar, login redirect, or any
 * admin page. It is a separate Rollup input, so none of that JS is emitted into
 * the embed chunk at all.
 *
 * Authentication is the shared embed key passed in the URL fragment
 * (#apiKey=...), read at runtime by params.ts and sent as X-Api-Key. Endpoint
 * protection is a backend concern — the /api/embed group is gated by
 * EmbedAuthMiddleware rather than JwtAuthMiddleware.
 */
const container = document.getElementById("embed-root");
if (!container) {
  throw new Error("embed-root element is missing from embed.html");
}

mount(container);
