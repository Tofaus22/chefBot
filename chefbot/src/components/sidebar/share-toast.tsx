"use client";

import { memo, useEffect } from "react";
import { Check } from "lucide-react";

interface ShareToastProps {
  onClose: () => void;
}

function ShareToastInner({ onClose }: ShareToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-secondary border border-border text-foreground text-sm px-4 py-2.5 rounded-full shadow-lg">
      <Check className="h-4 w-4 text-green-500" />
      Enlace copiado al portapapeles
    </div>
  );
}

export const ShareToast = memo(ShareToastInner);
