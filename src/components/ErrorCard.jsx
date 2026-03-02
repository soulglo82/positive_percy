import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorCard({ message = "Something went wrong", onRetry }) {
  return (
    <Card className="border-2 border-red-200 bg-red-50">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-10 h-10 text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-red-700 mb-2">Oops!</h3>
        <p className="text-sm text-red-600 mb-4">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="border-red-300 text-red-600 hover:bg-red-100">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
