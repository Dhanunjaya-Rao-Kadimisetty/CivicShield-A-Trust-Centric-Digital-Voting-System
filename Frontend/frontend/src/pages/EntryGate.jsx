import React, { useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";
import "../Styles/admin.css";

function EntryGate({ onVoterLogin, onAdminLogin }) {
  const [mode, setMode] = useState("voter");

  const handleContinue = () => {
    if (mode === "voter") {
      onVoterLogin();
    } else {
      onAdminLogin();
    }
  };

  return (
    <>
      <AppNavbar />

      <section className="cs-auth-page">
        <div className="container cs-auth-shell d-flex justify-content-center align-items-center">
          <div className="card cs-auth-card cs-screen-card p-4 p-sm-5 cs-entry-card">
            <div className="cs-auth-header text-center">
              <span className="cs-auth-badge">Choose Access Mode</span>
              <h1 className="cs-auth-title">Welcome to CivicShield</h1>
              <p className="cs-auth-subtitle mb-0">
                Select the correct portal to continue with secure access.
              </p>
            </div>

            <div className="cs-entry-toggle">
              <button
                type="button"
                className={`cs-entry-option ${mode === "voter" ? "is-active" : ""}`}
                onClick={() => setMode("voter")}
              >
                Voter Login
              </button>
              <button
                type="button"
                className={`cs-entry-option ${mode === "admin" ? "is-active" : ""}`}
                onClick={() => setMode("admin")}
              >
                Admin Login
              </button>
              <span className={`cs-entry-slider ${mode === "admin" ? "is-admin" : ""}`} />
            </div>

            <div className="cs-entry-panel">
              <div className={`cs-entry-panel-content ${mode === "voter" ? "is-active" : ""}`}>
                <h3>Voter Access</h3>
                <p>Verify identity, receive OTP, and cast a secure vote.</p>
              </div>
              <div className={`cs-entry-panel-content ${mode === "admin" ? "is-active" : ""}`}>
                <h3>Admin Control</h3>
                <p>Manage elections, upload voter datasets, and monitor activity.</p>
              </div>
            </div>

            <button
              type="button"
              className="btn w-100 cs-auth-btn cs-auth-form-group cs-auth-form-group-delay"
              onClick={handleContinue}
            >
              Continue
            </button>

            <div className="cs-auth-meta cs-auth-form-group cs-auth-form-group-delay-2" aria-hidden="true">
              <span>Role Based Entry</span>
              <span>Secure Channel</span>
              <span>Audit Ready</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default EntryGate;
