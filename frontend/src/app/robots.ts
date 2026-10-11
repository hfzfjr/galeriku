import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// PRD §11: larang /s/ dan /app/ dari perayap; hanya landing yang diindeks.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/s/", "/app/"] }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
