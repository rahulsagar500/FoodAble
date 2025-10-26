// web/src/components/LoginPrompt.jsx
import { Link } from "react-router-dom";

export default function LoginPrompt({ show, onClose }) {
  if (!show) return null;
  return (
    <div className="modal fade show" style={{ display: "block" }} tabIndex="-1" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Please sign in</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <p>You need to be signed in to reserve an offer. You can still add items to your cart and sign in later.</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Keep browsing</button>
            <Link className="btn btn-primary" to="/signin" onClick={onClose}>Sign in</Link>
            <Link className="btn btn-light" to="/signup" onClick={onClose}>Create account</Link>
          </div>
        </div>
      </div>
      {/* simple backdrop */}
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </div>
  );
}
