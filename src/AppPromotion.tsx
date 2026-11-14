import metadata from "../public/app-store/6819322032/metadata.json";
import { useI18n } from "./i18n";

export default function AppPromotion() {
  const { locale } = useI18n();
  const app = metadata.locales[locale];
  return (
    <a
      className="app-promotion"
      id="ios-app"
      href={app.url}
      target="_blank"
      rel="noreferrer"
    >
      <img src={app.icon} width="44" height="44" loading="lazy" alt="" />
      <span>{app.name.split(" - ")[0]}</span>
    </a>
  );
}
