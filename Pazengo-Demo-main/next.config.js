/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }]
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async redirects() {
    return [
      // Renamed: Recently viewed -> Recent activity (keep old bookmarks working)
      { source: "/recently-viewed", destination: "/recent-activity", permanent: true },
      { source: "/api/recently-viewed", destination: "/api/recent-activity", permanent: true },
      // Inventory split: old all-in-one page now lives under Published
      { source: "/admin/inventory", destination: "/admin/inventory/published", permanent: true },
      // Money queue merged into Pending review (single review screen)
      { source: "/admin/payments", destination: "/admin/inventory/pending-review", permanent: true }
    ];
  }
};
module.exports = nextConfig;
