import { CITED_MANIFEST_MARKDOWN } from "@/lib/senso/cited-manifest";

export const dynamic = "force-static";

export function GET() {
  return new Response(CITED_MANIFEST_MARKDOWN, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
