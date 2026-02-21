import React, { useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";
import "../Styles/admin.css";

function AdminLogin({ onBack, onSuccess }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmployeeId = employeeId.trim();
    const normalizedPassword = password.trim();

    if (!normalizedEmployeeId || !normalizedPassword) {
      alert("Please enter Employee ID and Password");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: normalizedEmployeeId,
          password: normalizedPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminEmployeeId", normalizedEmployeeId);
        alert("Admin login successful");
        onSuccess();
      } else {
        alert(data.message || "Invalid credentials");
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
          <div className="card cs-auth-card cs-screen-card p-4 p-sm-5 cs-admin-card">
            <div className="cs-auth-header text-center">
              <span className="cs-auth-badge">Administrative Access</span>
              <h1 className="cs-auth-title">Admin Login</h1>
              <p className="cs-auth-subtitle mb-0">
                Sign in with your employee credentials to manage election operations.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="cs-auth-form" noValidate>
              <div className="mb-3 cs-auth-form-group">
                <label htmlFor="employeeId" className="form-label cs-auth-label">
                  Employee ID
                </label>
                <div className="input-group cs-auth-input-group">
                  <span className="input-group-text cs-auth-icon" aria-hidden="true">
                    EMP
                  </span>
                  <input
                    id="employeeId"
                    type="text"
                    className="form-control cs-auth-input"
                    placeholder="Enter your employee ID"
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="mb-4 cs-auth-form-group cs-auth-form-group-delay">
                <label htmlFor="adminPassword" className="form-label cs-auth-label">
                  Password
                </label>
                <div className="input-group cs-auth-input-group">
                  <span className="input-group-text cs-auth-icon" aria-hidden="true">
                    KEY
                  </span>
                  <input
                    id="adminPassword"
                    type="password"
                    className="form-control cs-auth-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
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
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            <button
              type="button"
              className="btn w-100 mt-3 cs-auth-btn-outline cs-auth-form-group cs-auth-form-group-delay-2"
              onClick={onBack}
            >
              Back to Selection
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default AdminLogin;
