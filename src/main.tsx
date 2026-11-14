import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { I18nProvider } from "./i18n";
import { localeFromPath } from "./locales.mjs";

const root = document.getElementById("root")!;
const app = (
  <React.StrictMode>
    <I18nProvider initialLocale={localeFromPath(location.pathname) || "en"}>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, app);
else ReactDOM.createRoot(root).render(app);
