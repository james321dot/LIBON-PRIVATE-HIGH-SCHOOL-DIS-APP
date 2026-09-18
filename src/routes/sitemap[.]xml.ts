import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Absolute origin used for <loc> values. Defaults to the live request origin so
 * the sitemap is always valid on whatever host serves it (preview or custom
 * domain). Set VITE_SITE_URL at build time to pin a canonical domain.
 */
const CONFIGURED_BASE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(
  /\/+$/,
  "",
);

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const baseUrl = CONFIGURED_BASE_URL || new URL(request.url).origin.replace(/\/+$/, "");
        const entries: SitemapEntry[] = [{ path: "/", changefreq: "always", priority: "1.0" }];

        const urls = entries.map((e) =>
          [
            ` <url>`,
            `    <loc>${baseUrl}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
