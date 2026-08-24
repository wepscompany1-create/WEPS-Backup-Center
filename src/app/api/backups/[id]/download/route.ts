import { downloadBackup } from "@/app/api/backups/[id]/route";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return downloadBackup(request, id);
}
