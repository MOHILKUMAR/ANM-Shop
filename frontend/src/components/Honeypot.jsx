// A field people never see or reach with the keyboard; form-filling bots fill it in and are
// then ignored by the server (backend/middleware/spamGuard.js). Kept off-screen rather than
// display:none, which some bots skip. Its name matches nothing browsers or password managers
// autofill (unlike "website" or "url"), so real visitors' forms always send it empty.
function Honeypot({ value, onChange }) {
  return (
    <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor="leaveBlank">Leave this field empty</label>
      <input id="leaveBlank" name="leaveBlank" type="text" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export default Honeypot;
