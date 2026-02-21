import React, { useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";

function Login({ setStep, setVoterId }) {
  const [localVoterId, setLocalVoterId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(digitsOnly);
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const normalizedVoterId = localVoterId.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedVoterId || !normalizedPhone) {
      alert("Please enter Voter ID and Phone Number");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voterId: normalizedVoterId,
          Phone: normalizedPhone,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("OTP sent successfully");
        setVoterId(normalizedVoterId);
        setStep("otp");
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppNavbar />

      <section className="cs-auth-page">
        <div className="container cs-auth-shell d-flex justify-content-center align-items-center">
          <div className="card cs-auth-card cs-screen-card p-4 p-sm-5">
            <div className="cs-auth-header text-center">
              <span className="cs-auth-badge">Official Voter Access</span>
              <h1 className="cs-auth-title">Voter Login</h1>
              <p className="cs-auth-subtitle mb-0">
                Access your secure ballot session with verified voter credentials.
              </p>
            </div>

            <form onSubmit={handleLogin} className="cs-auth-form" noValidate>
              <div className="mb-3 cs-auth-form-group">
                <label htmlFor="voterId" className="form-label cs-auth-label">
                  Voter ID
                </label>
                <div className="input-group cs-auth-input-group">
                  <span className="input-group-text cs-auth-icon" aria-hidden="true">
                    ID
                  </span>
                  <input
                    id="voterId"
                    type="text"
                    className="form-control cs-auth-input"
                    placeholder="Enter your voter ID"
                    value={localVoterId}
                    onChange={(e) => setLocalVoterId(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="mb-4 cs-auth-form-group cs-auth-form-group-delay">
                <label htmlFor="phone" className="form-label cs-auth-label">
                  Phone Number
                </label>
                <div className="input-group cs-auth-input-group">
                  <span className="input-group-text cs-auth-icon" aria-hidden="true">
                    +91
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    className="form-control cs-auth-input"
                    placeholder="Enter your 10-digit phone number"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={10}
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </div>
                <small className="cs-auth-help">Numbers only, up to 10 digits.</small>
              </div>

              <button
                type="submit"
                className="btn w-100 cs-auth-btn cs-auth-form-group cs-auth-form-group-delay-2"
                disabled={loading}
              >
                {loading ? (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : null}
                {loading ? "Sending OTP..." : "Login"}
              </button>
            </form>

            <div className="cs-auth-meta cs-auth-form-group cs-auth-form-group-delay-2" aria-hidden="true">
              <span>Encrypted Session</span>
              <span>OTP Verification</span>
              <span>One Vote Only</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Login;
