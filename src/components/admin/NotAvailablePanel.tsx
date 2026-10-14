import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info } from "lucide-react";

export function NotAvailablePanel({ title = "Not available yet" }: { title?: string }) {
  return (
    <Card className="border-border/60 bg-muted/20">
      <CardHeader className="py-8 text-center items-center">
        <Info className="size-8 text-muted-foreground mb-2" />
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <CardDescription className="text-xs max-w-md">
          This endpoint has not been deployed on the backend yet. The admin console will display live data here once the companion backend service is active.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
