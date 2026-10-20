const SOURCE_DEFINITIONS = [
  ["clinic-profile", "ITC Immunity Therapy Center clinic profile"],
  [
    "adenocarcinoma-package",
    "Alternative Adenocarcinoma Cancer Treatment in Tijuana",
  ],
  ["adrenal-package", "Alternative Adrenal Cancer Treatment in Tijuana"],
  ["anal-package", "Alternative Anal Cancer Treatment in Tijuana"],
  ["clinic-videos", "ITC Tijuana Videos — Alternative Cancer Treatment"],
  ["price-list", "ITC Immunity Therapy Center — Price List"],
  [
    "price-comparison",
    "Alternative Medicine Cost Abroad — Compare Prices 2026",
  ],
] as const;

export const SOURCES = SOURCE_DEFINITIONS.map(([id, title]) => ({
  id,
  title,
  pageType: id.includes("price") ? "price" : "content",
  url: `https://placeholder.invalid/${id}`,
}));
