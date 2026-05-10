import type { MetadataRoute } from "next";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/result/",
          "/report/",
          "/friend/",
          "/zukan/",
          "/perceptions/",
          "/share",
          "/line-register",
          "/torisetsu/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
