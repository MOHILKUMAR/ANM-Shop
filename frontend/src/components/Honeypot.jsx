// A field people never see or reach with the keyboard; form-filling bots fill it in and are
// then ignored by the server (backend/middleware/spamGuard.js). Kept off-screen rather than
// display:none, which some bots skip.
function Honeypot({ value, onChange }) {
  return (
    <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor="website">Leave this field empty</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export default Honeypot;
