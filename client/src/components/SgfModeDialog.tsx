interface SgfModeDialogProps {
  itemTitle: string;
  onSelect: (mode: 'review' | 'puzzle') => void;
  onCancel: () => void;
}

export default function SgfModeDialog({ itemTitle, onSelect, onCancel }: SgfModeDialogProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sgf-mode-heading">
      <div className="modal">
        <h2 id="sgf-mode-heading">Open "{itemTitle}" as…</h2>
        <p>Select how you want to study this SGF file.</p>
        <div className="modal-actions">
          <button type="button" onClick={() => onSelect('review')} className="modal-primary">
            Review (Besogo)
          </button>
          <button type="button" onClick={() => onSelect('puzzle')} className="modal-secondary">
            Puzzle Mode (Glift)
          </button>
        </div>
        <button type="button" className="modal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
