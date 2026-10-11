import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// Hanya root (landing) yang boleh diindeks. /dev/* dijaga proxy + noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${getSiteUrl()}/` }];
}
