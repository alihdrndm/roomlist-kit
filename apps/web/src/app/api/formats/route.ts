import { getFromApi } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getFromApi("/v1/formats", request);
}
