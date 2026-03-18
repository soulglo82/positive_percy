import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { PERCY } from "@/constants/terminology";

export default function ShareableCard({ child, message = "Weekly Goal Achieved!" }) {
  const cardRef = useRef(null);

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'percy-achievement.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          text: `${child.name} ${message.toLowerCase()} on Positive Percy!`,
          files: [file],
        });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'percy-achievement.png';
        a.click();
        toast.success('Achievement card downloaded!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Could not share. Try again.');
      }
    }
  };

  return (
    <div>
      {/* Hidden card for capture */}
      <div
        ref={cardRef}
        style={{
          width: 400,
          padding: 32,
          background: 'linear-gradient(135deg, #a855f7, #ec4899, #3b82f6)',
          borderRadius: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'absolute',
          left: -9999,
          top: -9999,
        }}
      >
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 16,
          padding: 24,
        }}>
          {child.avatar_url ? (
            <img
              src={child.avatar_url}
              alt={child.name}
              crossOrigin="anonymous"
              style={{
                width: 80, height: 80, borderRadius: '50%',
                objectFit: 'cover', border: '4px solid rgba(255,255,255,0.5)',
                margin: '0 auto 12px',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, fontWeight: 'bold', color: 'white',
              margin: '0 auto 12px',
            }}>
              {child.name.charAt(0)}
            </div>
          )}

          <div style={{ fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 4 }}>
            {child.name}
          </div>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white', marginBottom: 4 }}>
            {child.total_points} {PERCY.POINTS_COMPACT}
          </div>
          <div style={{
            fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.9)',
            marginBottom: 16,
          }}>
            {message}
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.6)',
            letterSpacing: 1,
          }}>
            positivepercy.app
          </div>
        </div>
      </div>

      {/* Share button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="text-purple-600 border-purple-200 hover:bg-purple-50"
      >
        <Share2 className="w-3.5 h-3.5 mr-1" />
        Share
      </Button>
    </div>
  );
}
