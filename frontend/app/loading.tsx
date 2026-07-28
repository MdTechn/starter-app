export default function Loading() {
  return (
    <div
      className="global-loading-overlay"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Chargement"
    >
      <div
        className="global-loading-spinner"
        style={{ width: 44, height: 44 }}
      />
      <span className="global-loading-label">Chargement…</span>
    </div>
  );
}
