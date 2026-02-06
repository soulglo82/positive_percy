import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Coins } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function RedemptionCard({ redemption, onApprove, onDeny }) {
  const isPending = redemption.status === "Pending";
  
  const statusConfig = {
    Pending: { icon: Clock, color: "bg-amber-100 text-amber-700", iconColor: "text-amber-600" },
    Approved: { icon: CheckCircle, color: "bg-green-100 text-green-700", iconColor: "text-green-600" },
    Denied: { icon: XCircle, color: "bg-rose-100 text-rose-700", iconColor: "text-rose-600" },
  };

  const config = statusConfig[redemption.status] || statusConfig.Pending;
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 mb-1">
                {redemption.child_name}
              </h4>
              <p className="text-sm text-slate-600 mb-2">
                wants: <span className="font-semibold">{redemption.reward_title}</span>
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  {redemption.reward_cost} points
                </span>
                <span>
                  {format(new Date(redemption.created_date), "MMM d, h:mm a")}
                </span>
              </div>
            </div>
            <Badge className={`${config.color} border-0`}>
              <StatusIcon className={`w-3 h-3 mr-1 ${config.iconColor}`} />
              {redemption.status}
            </Badge>
          </div>

          {isPending && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onApprove(redemption)}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDeny(redemption)}
                className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Deny
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
