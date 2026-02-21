import React, { useEffect, useMemo, useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";
import "../Styles/results.css";

import bjpLogo from "../assets/BJP-Logo.png";
import incLogo from "../assets/INC-Logo.png";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

function Results({ setStep }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalVotes, setTotalVotes] = useState(0);
  const [receiptGeneratedAt, setReceiptGeneratedAt] = useState("");
  const storedElectionId = Number(localStorage.getItem("selectedElectionId"));
  const electionId = Number.isFinite(storedElectionId) && storedElectionId > 0 ? storedElectionId : 1;

  const partyLogos = {
    BJP: bjpLogo,
    INC: incLogo,
  };

  useEffect(() => {
    fetch(`http://localhost:5000/results/${electionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setResults(data.results);
          const total = data.results.reduce((sum, row) => sum + row.total_votes, 0);
          setTotalVotes(total);
        } else {
          setError("Failed to load results");
        }
      })
      .catch(() => {
        setError("Failed to load results.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [electionId]);

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.total_votes - a.total_votes),
    [results]
  );

  const winner = useMemo(() => {
    if (results.length === 0) {
      return null;
    }
    return results.reduce((prev, curr) => (prev.total_votes > curr.total_votes ? prev : curr));
  }, [results]);

  const getVotePercentage = (votes) => {
    return totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
  };

  const downloadReceipt = async () => {
    const receiptHash = localStorage.getItem("voteReceiptHash");
    const txHash = localStorage.getItem("voteTxHash");

    if (!receiptHash) {
      setError("No receipt found. Please vote first.");
      return;
    }

    const verifyUrl = txHash ? `${window.location.origin}/verify/${txHash}` : window.location.origin;
    const receiptDiv = document.getElementById("receipt");
    setReceiptGeneratedAt(new Date().toLocaleString());

    receiptDiv.style.display = "block";

    try {
      await QRCode.toCanvas(document.getElementById("qr-code"), verifyUrl, {
        width: 170,
        margin: 1,
        color: {
          dark: "#0b2a3d",
          light: "#ffffff",
        },
      });

      const canvas = await html2canvas(receiptDiv, {
        scale: 2,
        backgroundColor: "#f4faf9",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", margin, 8, imgWidth, imgHeight);
      pdf.save("CivicShield_Vote_Receipt.pdf");
    } finally {
      receiptDiv.style.display = "none";
    }
  };

  return (
    <>
      <AppNavbar />

      <div id="receipt" className="cs-receipt-sheet" style={{ display: "none" }}>
        <div className="cs-receipt-topbar"></div>

        <header className="cs-receipt-header">
          <div className="cs-receipt-brand-icon">CS</div>
          <div>
            <h2>CivicShield - Secure Digital Voting</h2>
            <p>Official Vote Receipt</p>
          </div>
        </header>

        <div className="cs-receipt-pill-row">
          <span className="cs-receipt-pill">Blockchain Verified</span>
          <span className="cs-receipt-pill">Tamper Evident</span>
          <span className="cs-receipt-pill">Election ID: {electionId}</span>
        </div>

        <section className="cs-receipt-section">
          <div className="cs-receipt-item">
            <span>Receipt Hash</span>
            <strong>{localStorage.getItem("voteReceiptHash")}</strong>
          </div>
          <div className="cs-receipt-item">
            <span>Transaction Hash</span>
            <strong>{localStorage.getItem("voteTxHash")}</strong>
          </div>
          <div className="cs-receipt-meta-grid">
            <div>
              <span className="cs-receipt-meta-label">Issued At</span>
              <p>{receiptGeneratedAt || new Date().toLocaleString()}</p>
            </div>
            <div>
              <span className="cs-receipt-meta-label">Status</span>
              <p>Vote Recorded Successfully</p>
            </div>
          </div>
        </section>

        <section className="cs-receipt-section cs-receipt-verify">
          <div>
            <h4>Verification QR</h4>
            <p>Scan to validate this vote receipt on the verification endpoint.</p>
            <small>{localStorage.getItem("voteTxHash") ? `${window.location.origin}/verify/${localStorage.getItem("voteTxHash")}` : window.location.origin}</small>
          </div>
          <canvas id="qr-code"></canvas>
        </section>

        <footer className="cs-receipt-footer">
          Powered by CivicShield Blockchain Voting Platform
        </footer>
      </div>

      <section className="cs-auth-page">
        <div className="container cs-auth-shell d-flex justify-content-center align-items-center">
          <div className="card cs-auth-card cs-screen-card cs-results-card border-0">
            <div className="cs-results-header text-center p-4 p-sm-5 pb-4">
              <span className="cs-auth-badge">Election Dashboard</span>
              <h1 className="cs-auth-title">Election Results</h1>
              <p className="cs-auth-subtitle mb-0">Live voting statistics and verified candidate standings.</p>
            </div>

            <div className="card-body cs-screen-body p-4 p-sm-5 pt-4">
              {error && <div className="alert alert-danger cs-results-alert">{error}</div>}

              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-info" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 cs-results-muted">Loading election results...</p>
                </div>
              ) : (
                <>
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <div className="cs-results-stat text-center">
                        <p className="cs-results-stat-value mb-1">{totalVotes}</p>
                        <p className="cs-results-stat-label mb-0">Total Votes</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="cs-results-stat text-center">
                        <p className="cs-results-stat-value mb-1">{results.length}</p>
                        <p className="cs-results-stat-label mb-0">Candidates</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="cs-results-stat text-center">
                        <p className="cs-results-stat-value mb-1">{winner ? winner.Candidate_Name : "N/A"}</p>
                        <p className="cs-results-stat-label mb-0">Leading</p>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive cs-results-table-wrap">
                    <table className="table mb-0 cs-results-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Candidate</th>
                          <th>Party</th>
                          <th>Votes</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedResults.map((row, index) => (
                          <tr key={`${row.Candidate_Name}-${index}`}>
                            <td>{index + 1}</td>
                            <td className="fw-semibold text-light">{row.Candidate_Name}</td>
                            <td>
                              <span className="cs-party-cell">
                                <img src={partyLogos[row.Party_Name]} alt={`${row.Party_Name} Logo`} className="cs-party-logo" />
                                {row.Party_Name}
                              </span>
                            </td>
                            <td>{row.total_votes}</td>
                            <td>{getVotePercentage(row.total_votes)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-center mt-4 d-flex flex-column flex-sm-row justify-content-center gap-2">
                    <button className="btn cs-auth-btn cs-action-btn px-4" onClick={downloadReceipt}>
                      Download Vote Receipt
                    </button>

                    <button className="btn cs-auth-btn-outline cs-action-btn px-4" onClick={() => setStep("verify")}>
                      Verify My Vote
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Results;
