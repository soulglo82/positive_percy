import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorCard({ message = "Something went wrong", onRetry }) {
  return (
    <Card className="border-warning-border bg-warning">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mb-4" strokeWidth={1.5} aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Oops!</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
