import { forwardUpload } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return forwardUpload(request, "/v1/rooming-lists/diff", 2);
}
