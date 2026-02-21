import React, { useEffect, useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";
import "../Styles/verify.css";

function VoteVerify() {
  const [txHash, setTxHash] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedTx = localStorage.getItem("voteTxHash");
    if (savedTx) {
      setTxHash(savedTx.trim());
    }
  }, []);

  const handleVerify = async (event) => {
    event.preventDefault();

    const cleanTx = txHash.trim();

    if (!cleanTx) {
      setError("Transaction hash not found. Please vote first.");
      return;
    }

    if (!cleanTx.startsWith("0x") || cleanTx.length !== 66) {
      setError("Invalid transaction hash format.");
      return;
    }

    setError("");
    setResult(null);

    try {
      setLoading(true);

      const response = await fetch("http://localhost:5000/verify-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionHash: cleanTx }),
      });

      const data = await response.json();
      setResult(Boolean(data.verified));
    } catch (verifyError) {
      console.error("Verify vote error:", verifyError);
      setError("Backend not reachable or verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyHash = async () => {
    if (!txHash) {
      return;
    }

    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy transaction hash.");
    }
  };

  return (
    <>
      <AppNavbar />

      <section className="cs-auth-page">
        <div className="container cs-auth-shell d-flex justify-content-center align-items-center">
          <div className="card cs-auth-card cs-screen-card cs-verify-card border-0">
            <div className="cs-verify-header text-center p-4 p-sm-5 pb-4">
              <span className="cs-auth-badge">Blockchain Audit</span>
              <h1 className="cs-auth-title">Vote Verification</h1>
              <p className="cs-auth-subtitle mb-0">Verify your vote transaction directly from the blockchain record.</p>
            </div>

            <div className="card-body cs-screen-body p-4 p-sm-5 pt-4">
              <form onSubmit={handleVerify} noValidate>
                <label htmlFor="txHash" className="form-label cs-auth-label">
                  Transaction Hash
                </label>
                <div className="cs-verify-hash-wrap cs-auth-form-group">
                  <textarea
                    id="txHash"
                    className={`form-control cs-verify-hash ${error ? "is-invalid" : ""}`}
                    rows="3"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value.trim())}
                    placeholder="Enter transaction hash"
                  />
                  <button
                    type="button"
                    className="btn cs-verify-copy"
                    onClick={handleCopyHash}
                    disabled={!txHash}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                {error && (
                  <div className="alert alert-danger cs-verify-alert mt-3 mb-0" role="alert">
                    {error}
                  </div>
                )}

                <button className="btn w-100 cs-auth-btn mt-3" disabled={loading} type="submit">
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Verifying Transaction...
                    </>
                  ) : (
                    "Verify Vote"
                  )}
                </button>
              </form>

              {result !== null && (
                <div className={`cs-verify-result mt-4 ${result ? "is-success" : "is-failed"}`}>
                  <div className="cs-verify-result-icon" aria-hidden="true">
                    {result ? "OK" : "NO"}
                  </div>
                  <div>
                    <h5>{result ? "Verification Successful" : "Verification Failed"}</h5>
                    <p>
                      {result
                        ? "Your vote has been recorded and verified on-chain. The transaction is immutable and auditable."
                        : "The transaction hash was not verified. Check the hash and try again."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="cs-verify-footer text-center">
              <span>Secure</span>
              <span>Transparent</span>
              <span>Immutable</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default VoteVerify;
