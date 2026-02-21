import React, { useEffect, useRef, useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

function OtpVerify({ voterId, setStep }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) {
      return undefined;
    }

    const timerId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [resendTimer]);

  const otpString = otp.join("");

  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const updatedOtp = [...otp];
    updatedOtp[index] = digit;
    setOtp(updatedOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      if (otp[index]) {
        const updatedOtp = [...otp];
        updatedOtp[index] = "";
        setOtp(updatedOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);

    if (!pasted) {
      return;
    }

    const updatedOtp = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((digit, index) => {
      updatedOtp[index] = digit;
    });

    setOtp(updatedOtp);

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    if (otpString.length !== OTP_LENGTH) {
      alert("Please enter complete OTP");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voterId,
          otp: otpString,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("OTP verified successfully");
        localStorage.setItem("voterId", voterId);
        setStep("vote");
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || resendLoading) {
      return;
    }

    try {
      setResendLoading(true);
      const response = await fetch("http://localhost:5000/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId }),
      });

      const data = await response.json();
      alert(data.message);
      setResendTimer(RESEND_COOLDOWN);
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <>
      <AppNavbar />

      <section className="cs-auth-page">
        <div className="container cs-auth-shell d-flex justify-content-center align-items-center">
          <div className="card cs-auth-card cs-screen-card p-4 p-sm-5 cs-otp-card">
            <div className="cs-auth-header text-center">
              <span className="cs-auth-badge">Identity Verification</span>
              <h1 className="cs-auth-title">Verify OTP</h1>
              <p className="cs-auth-subtitle mb-0">
                Enter the 6-digit code sent to your registered mobile number.
              </p>
            </div>

            <form onSubmit={handleVerify} className="cs-auth-form" noValidate>
              <div className="cs-otp-grid cs-auth-form-group" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element;
                    }}
                    type="text"
                    className="form-control cs-otp-input"
                    value={digit}
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    onChange={(event) => handleChange(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    aria-label={`OTP digit ${index + 1}`}
                  />
                ))}
              </div>

              <div className="cs-otp-helper cs-auth-form-group cs-auth-form-group-delay">
                <span>Didn&apos;t receive code? Request a new OTP securely.</span>
              </div>

              <button
                type="submit"
                className="btn w-100 cs-auth-btn cs-auth-form-group cs-auth-form-group-delay"
                disabled={loading || otpString.length !== OTP_LENGTH}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                ) : null}
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <button
                type="button"
                className="btn w-100 mt-2 cs-auth-btn-outline cs-auth-form-group cs-auth-form-group-delay-2"
                onClick={handleResendOtp}
                disabled={resendLoading || resendTimer > 0}
              >
                {resendLoading ? "Resending..." : resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
              </button>
            </form>

            <div className="cs-auth-meta cs-auth-form-group cs-auth-form-group-delay-2" aria-hidden="true">
              <span>Secure OTP Channel</span>
              <span>Anti Replay Guard</span>
              <span>Election Access Gate</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default OtpVerify;
