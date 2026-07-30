/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The tool is a section of inspireambitions.com, not a separate property, so
  // every route and asset is served under this prefix.
  //
  // This must stay identical to BRAND.basePath in lib/brand.ts — canonicalUrl(),
  // the sitemap, and the emailed report link all derive from that constant, and
  // a mismatch produces links that 404. There is a guard for this in
  // lib/brand.ts's test-free contract: change one, change both.
  basePath: "/career-change-roadmap",
};

export default nextConfig;
