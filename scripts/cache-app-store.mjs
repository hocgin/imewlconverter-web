import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Explicit refresh only: builds remain reproducible and work without Apple's API.
const directory = new URL("../public/app-store/6819322032/", import.meta.url);
await mkdir(directory, { recursive: true });
const locales = { en: "us", "zh-hans": "cn", "zh-hant": "tw" };
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}
async function cacheImage(url, label) {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  const file = `${label}-${hash}.jpg`;
  const target = new URL(file, directory);
  try {
    await readFile(target);
  } catch {
    const response = await get(url);
    if (!response.headers.get("content-type")?.startsWith("image/"))
      throw new Error(`Not an image: ${url}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  return `/app-store/6819322032/${file}`;
}
const entries = {};
for (const [locale, country] of Object.entries(locales)) {
  const source = `https://itunes.apple.com/lookup?id=6819322032&country=${country}`;
  const result = await (await get(source)).json();
  const app = result.results?.find((item) => item.trackId === 6819322032);
  if (!app)
    throw new Error(`App not available in ${country}; existing metadata kept.`);
  await writeFile(
    new URL(`itunes-${country}.json`, directory),
    JSON.stringify(result, null, 2) + "\n",
  );
  entries[locale] = {
    name: app.trackName,
    url: app.trackViewUrl,
    version: app.version,
    minimumOsVersion: app.minimumOsVersion,
    icon: await cacheImage(app.artworkUrl512 || app.artworkUrl100, "ddup-icon"),
    source,
  };
}
await writeFile(
  new URL("metadata.json", directory),
  JSON.stringify(
    {
      appId: "6819322032",
      fetchedAt: new Date().toISOString(),
      locales: entries,
    },
    null,
    2,
  ) + "\n",
);
console.log("Cached DDUP metadata and app icon.");
