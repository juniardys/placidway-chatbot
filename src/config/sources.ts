const SOURCE_DEFINITIONS = [
  [
    "clinic-profile",
    "ITC Immunity Therapy Center clinic profile",
    "https://www.placidway.com/profile/5/Alternative-Cancer-Treatment-by-ITC-Immunity-Therapy-Center",
  ],
  [
    "adenocarcinoma-package",
    "Alternative Adenocarcinoma Cancer Treatment in Tijuana",
    "https://www.placidway.com/package/7903/Alternative-Adenocarcinoma-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC",
  ],
  [
    "adrenal-package",
    "Alternative Adrenal Cancer Treatment in Tijuana",
    "https://www.placidway.com/package/7902/Alternative-Adrenal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC",
  ],
  [
    "anal-package",
    "Alternative Anal Cancer Treatment in Tijuana",
    "https://www.placidway.com/package/7901/Alternative-Anal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC",
  ],
  [
    "clinic-videos",
    "ITC Tijuana Videos — Alternative Cancer Treatment",
    "https://www.placidway.com/profile-videos/5/Alternative-Cancer-Treatment-by-ITC-Immunity-Therapy-Center",
  ],
  [
    "price-list",
    "ITC Immunity Therapy Center — Price List",
    "https://www.placidway.com/price-list/5/Alternative-Cancer-Treatment-by-ITC-Immunity-Therapy-Center",
  ],
  [
    "price-comparison",
    "Alternative Medicine Cost Abroad — Compare Prices 2026",
    "https://www.placidway.com/search-medical-pricings/Alternative-Medicine/All/1",
  ],
] as const;

export const SOURCES = SOURCE_DEFINITIONS.map(([id, title, url]) => ({
  id,
  title,
  pageType: id.includes("price") ? "price" : "content",
  url,
}));
