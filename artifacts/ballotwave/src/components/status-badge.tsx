import { Badge } from "@/components/ui/badge";
import { ElectionStatus } from "@workspace/api-client-react";

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case ElectionStatus.active:
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Active</Badge>;
    case ElectionStatus.draft:
      return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200">Draft</Badge>;
    case ElectionStatus.closed:
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Closed</Badge>;
    case ElectionStatus.cancelled:
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
