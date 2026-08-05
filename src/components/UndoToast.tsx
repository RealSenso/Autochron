import React from 'react';
import { Undo2, X, CheckCircle2 } from 'lucide-react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onClose: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ message, onUndo, onClose }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-stone-900 text-white px-4 py-3 rounded-lg shadow-2xl border border-stone-700 animate-slide-up">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="text-xs font-semibold text-stone-100">{message}</span>

      <button
        onClick={onUndo}
        className="ml-2 flex items-center gap-1.5 bg-vela-600 hover:bg-vela-500 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors shadow-xs"
      >
        <Undo2 className="w-3.5 h-3.5" />
        <span>Undo</span>
      </button>

      <button
        onClick={onClose}
        className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
