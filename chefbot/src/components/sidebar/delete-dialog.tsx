"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";

interface DeleteDialogProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteDialogInner({ title, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 w-80 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-sm mb-1">Eliminar conversación</h3>
          <p className="text-xs text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">&quot;{title}&quot;</span>? Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Eliminar</Button>
        </div>
      </div>
    </div>
  );
}

export const DeleteDialog = memo(DeleteDialogInner);
