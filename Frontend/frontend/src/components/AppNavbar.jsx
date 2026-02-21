import React from "react";
import "../Styles/auth.css";

function AppNavbar() {
  return (
    <nav className="navbar navbar-expand-lg cs-navbar">
      <div className="container d-flex justify-content-center">
        <span className="navbar-brand mb-0 h1 fw-semibold text-white d-flex align-items-center cs-navbar-brand">
          <span className="cs-navbar-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" role="img" focusable="false">
              <path
                d="M12 2L4.5 5v6c0 4.97 3.18 9.52 7.5 11 4.32-1.48 7.5-6.03 7.5-11V5L12 2z"
                fill="currentColor"
                opacity="0.3"
              />
              <path
                d="M12 3.85L6 6.25V11c0 3.99 2.45 7.63 6 9.05 3.55-1.42 6-5.06 6-9.05V6.25L12 3.85z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M8.75 11.5L10.8 13.6L15.25 9.15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          CivicShield - Secure Voting
        </span>
      </div>
    </nav>
  );
}

export default AppNavbar;
