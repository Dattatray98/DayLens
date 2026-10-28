import { useEffect } from "react";
import { FiX } from "react-icons/fi";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({ title, message, confirmLabel, busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="money-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <div className="modal-heading"><h2 id="confirm-dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onCancel}><FiX /></button></div>
      <div className="delete-confirm"><p id="confirm-dialog-message">{message}</p><div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? "Please wait…" : confirmLabel}</button></div></div>
    </section>
  </div>;
}
