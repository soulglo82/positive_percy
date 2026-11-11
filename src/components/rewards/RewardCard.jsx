import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Pencil, Plus, Check } from "lucide-react";
import { Points } from "@/components/brand/PointsStar";
import EmojiTile from "./EmojiTile";

export default function RewardCard({ reward, onToggleStack, isParentView, onToggleVisibility, onEdit, canAfford, childPoints, assignedChildren = [], isInStack = false }) {
  const pointsNeeded = reward.cost_points - (childPoints || 0);
  const hidden = !reward.visible_to_child && isParentView;

  return (
    <Card className={`overflow-hidden ${
      isInStack ? 'border-2 border-selected-border bg-selected' : hidden ? 'bg-muted' : ''
    }`}>
      {reward.image_url && (
        <div
          className="h-32 bg-cover bg-center"
          role="img"
          aria-label={reward.title}
          style={{ backgroundImage: `url(${reward.image_url})` }}
        />
      )}

      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-2">
          {!reward.image_url && <EmojiTile emoji={reward.emoji} />}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg line-clamp-2">
              {reward.title}
            </h3>
            {hidden && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <EyeOff className="w-3 h-3" aria-hidden="true" />
                Hidden from children
              </p>
            )}
          </div>
          {isParentView && (
            <div className="flex -mt-2 -mr-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={() => onEdit(reward)}
                aria-label={`Edit ${reward.title}`}
              >
                <Pencil className="w-4 h-4" strokeWidth={1.5} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={() => onToggleVisibility(reward)}
                aria-label={reward.visible_to_child ? `Hide ${reward.title} from children` : `Show ${reward.title} to children`}
              >
                {reward.visible_to_child ? (
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                )}
              </Button>
            </div>
          )}
        </div>

        {reward.description && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {reward.description}
          </p>
        )}

        {isParentView && assignedChildren.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">Assigned to:</p>
            <div className="flex flex-wrap gap-1">
              {assignedChildren.map(child => (
                <Badge key={child.id} variant="outline" className="text-xs">
                  {child.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Points value={reward.cost_points} className="text-lg font-semibold text-foreground" starClassName="h-5 w-5" />
          {!isParentView && onToggleStack && (
            <>
              {isInStack ? (
                <Button
                  size="sm"
                  variant="outline"
                  aria-pressed="true"
                  onClick={() => onToggleStack(reward)}
                >
                  <Check className="w-4 h-4" />
                  Added
                </Button>
              ) : canAfford ? (
                <Button size="sm" onClick={() => onToggleStack(reward)}>
                  <Plus className="w-4 h-4" />
                  Add to stack
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Need {pointsNeeded} more pts
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
