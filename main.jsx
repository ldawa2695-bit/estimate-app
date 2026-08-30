import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// ---------------------------------------------------------------------------
// window.storage shim
// EstiMate was originally built as a Claude artifact, where window.storage is
// provided by the host page (Claude.ai) for saving/loading data per user.
// Outside Claude there's no such host, so this shim reproduces the same
// get/set/delete/list API using the browser's own localStorage instead.
// Nothing in App.jsx needs to change — it just keeps working.
// ---------------------------------------------------------------------------
const PREFIX = "estimate-app:";

window.storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) {
      throw new Error(`Key not found: ${key}`);
    }
    return { key, value: raw, shared };
  },
  async set(key, value, shared = false) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value, shared };
  },
  async delete(key, shared = false) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true, shared };
  },
  async list(prefix = "", shared = false) {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length))
      .filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared };
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
