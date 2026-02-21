import React, { useEffect, useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/auth.css";
import "../Styles/vote.css";

import bjpLogo from "../assets/BJP-Logo.png";
import incLogo from "../assets/INC-Logo.png";

const partyLogos = {
  BJP: bjpLogo,
  INC: incLogo,
};

function Vote({ voterId, setStep }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [electionsLoading, setElectionsLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [hasRequestedCandidates, setHasRequestedCandidates] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const getElectionId = (election) => String(election?.Id || election?.id || "");
  const getElectionName = (election) =>
    election?.Election_Name || election?.election_name || election?.Title || election?.title || "Untitled";
  const getElectionStatus = (election) =>
    String(election?.status || election?.Status || election?.status_text || "inactive").toLowerCase();
  const effectiveVoterId = voterId || localStorage.getItem("voterId") || "";
  const getCandidateId = (candidate) => candidate?.Id || candidate?.id;
  const getCandidateName = (candidate) => candidate?.Candidate_Name || candidate?.candidate_name || "Unknown";
  const getCandidateParty = (candidate) => candidate?.Party_Name || candidate?.party_name || "Independent";

  useEffect(() => {
    setElectionsLoading(true);
    const electionsUrl = effectiveVoterId
      ? `http://localhost:5000/elections?voterId=${encodeURIComponent(effectiveVoterId)}`
      : "http://localhost:5000/elections";
    fetch(electionsUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const all = Array.isArray(data.data) ? data.data : [];
          const votingFriendly = all.filter((row) => {
            const status = getElectionStatus(row);
            return status === "active" || status === "scheduled";
          });
          const nextElections = votingFriendly.length ? votingFriendly : all;
          setElections(nextElections);
          setSelectedElectionId((prev) => {
            const existing = nextElections.some((row) => getElectionId(row) === String(prev || ""));
            return existing ? String(prev || "") : getElectionId(nextElections[0] || "");
          });
        } else {
          setElections([]);
          setSelectedElectionId("");
          setError(data.message || "Failed to load elections.");
        }
      })
      .catch(() => {
        setElections([]);
        setSelectedElectionId("");
        setError("Failed to load elections. Please check your connection.");
      })
      .finally(() => {
        setElectionsLoading(false);
      });
  }, [effectiveVoterId]);

  const loadCandidatesForSelectedElection = () => {
    if (!selectedElectionId) {
      setCandidates([]);
      setHasRequestedCandidates(false);
      setError("Please select an election first.");
      return;
    }

    setError("");
    setCandidatesLoading(true);
    setHasRequestedCandidates(true);
    const candidateUrl = effectiveVoterId
      ? `http://localhost:5000/candidates/${selectedElectionId}?voterId=${encodeURIComponent(effectiveVoterId)}`
      : `http://localhost:5000/candidates/${selectedElectionId}`;
    fetch(candidateUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCandidates(data.data || []);
          setSelectedCandidate("");
        } else {
          setCandidates([]);
          setError("Failed to load candidates.");
        }
      })
      .catch(() => {
        setCandidates([]);
        setError("Failed to load candidates. Please check your connection.");
      })
      .finally(() => {
        setCandidatesLoading(false);
      });
  };

  const handleVote = async () => {
    if (!selectedElectionId) {
      setError("Please select an election before voting.");
      return;
    }
    if (!selectedCandidate) {
      setError("Please select a candidate before submitting your vote.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      setLoading(true);

      const response = await fetch("http://localhost:5000/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voterId: effectiveVoterId,
          electionId: selectedElectionId,
          candidateId: selectedCandidate,
          pin,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("selectedElectionId", String(selectedElectionId));
        localStorage.setItem("voteReceiptHash", data.receiptHash);
        localStorage.setItem("voteTxHash", data.transactionHash);
        setSuccess(`Vote cast successfully.\n\nReceipt Hash:\n${data.receiptHash}\n\nTx Hash:\n${data.transactionHash}`);
        setTimeout(() => setStep("results"), 3000);
      } else {
        setError(data.message);
        if (data.message.toLowerCase().includes("already voted")) {
          setTimeout(() => setStep("results"), 2000);
        }
      }
    } catch (voteError) {
      console.error("Vote error:", voteError);
      setError("Backend not reachable. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPin = async () => {
    if (!pin.trim()) {
      setError("Enter your PIN to unlock the candidate list.");
      return;
    }

    setError("");

    try {
      setPinLoading(true);
      const response = await fetch("http://localhost:5000/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voterId: voterId || localStorage.getItem("voterId"),
          pin,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsUnlocked(true);
      } else {
        setError("Invalid PIN. Please try again.");
      }
    } catch (pinError) {
      console.error("PIN verify error:", pinError);
      setError("Unable to verify PIN right now. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <>
      <AppNavbar />

      <section className="cs-auth-page">
        <div className="container cs-auth-shell d-flex justify-content-center align-items-center">
          <div className="card cs-auth-card cs-screen-card cs-vote-card border-0">
            <div className="cs-vote-header text-center p-4 p-sm-5 pb-4">
              <span className="cs-auth-badge">Ballot Station</span>
              <h1 className="cs-auth-title">Cast Your Vote</h1>
              <p className="cs-auth-subtitle mb-0">Select your preferred candidate and submit securely.</p>
            </div>

            <div className="card-body cs-screen-body p-4 p-sm-5 pt-4">
              {error && (
                <div className="alert alert-danger cs-vote-alert" role="alert">
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success cs-vote-alert" role="alert" style={{ whiteSpace: "pre-line" }}>
                  {success}
                </div>
              )}

              {!isUnlocked && (
                <div className="cs-lock-panel text-center">
                  <div className="cs-lock-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path d="M7 10V7a5 5 0 1110 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
                    </svg>
                  </div>
                  <h4 className="cs-lock-title">Candidate List Is Locked</h4>
                  <p className="cs-lock-subtitle">Enter your Secret PIN to unlock the verified candidate panel.</p>

                  <div className="input-group cs-lock-input-group mx-auto">
                    <input
                      type={showPin ? "text" : "password"}
                      className="form-control cs-lock-input"
                      placeholder="Enter Secret PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          verifyPin();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn cs-lock-toggle"
                      onClick={() => setShowPin((prev) => !prev)}
                      aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showPin ? "Hide" : "Show"}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn cs-auth-btn mt-3 px-4"
                    onClick={verifyPin}
                    disabled={pinLoading}
                  >
                    {pinLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Verifying...
                      </>
                    ) : (
                      "Unlock Candidate List"
                    )}
                  </button>
                </div>
              )}

              {isUnlocked && (
                <>
                  <div className="cs-vote-election-picker">
                    <label htmlFor="electionSelect" className="cs-vote-election-label">
                      Select Election
                    </label>
                    <select
                      id="electionSelect"
                      className="form-select cs-vote-election-select"
                      value={selectedElectionId}
                      onChange={(e) => {
                        setSelectedElectionId(e.target.value);
                        setHasRequestedCandidates(false);
                        setCandidates([]);
                        setSelectedCandidate("");
                      }}
                      disabled={electionsLoading || elections.length === 0}
                    >
                      {!elections.length ? (
                        <option value="">
                          {electionsLoading ? "Loading elections..." : "No elections available"}
                        </option>
                      ) : null}
                      {elections.map((election) => (
                        <option key={getElectionId(election)} value={getElectionId(election)}>
                          {getElectionName(election)} ({getElectionStatus(election)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn cs-auth-btn cs-vote-load-btn mt-3"
                      onClick={loadCandidatesForSelectedElection}
                      disabled={!selectedElectionId || candidatesLoading}
                    >
                      {candidatesLoading ? "Loading Candidates..." : "Show Candidates"}
                    </button>
                  </div>

                  {hasRequestedCandidates && candidatesLoading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-info" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-3 cs-lock-subtitle">Loading candidates...</p>
                    </div>
                  ) : hasRequestedCandidates && candidates.length ? (
                    <div className="candidate-list mt-2">
                      {candidates.map((c) => (
                        <div
                          key={getCandidateId(c)}
                          className={`card mb-3 candidate-card cs-candidate-card ${
                            selectedCandidate === getCandidateId(c) ? "cs-candidate-selected" : ""
                          }`}
                          onClick={() => setSelectedCandidate(getCandidateId(c))}
                        >
                          <div className="card-body d-flex align-items-center justify-content-between p-3">
                            <div className="d-flex align-items-center flex-grow-1">
                              <div className="form-check me-3">
                                <input
                                  type="radio"
                                  name="candidate"
                                  className="form-check-input"
                                  checked={selectedCandidate === getCandidateId(c)}
                                  onChange={() => setSelectedCandidate(getCandidateId(c))}
                                />
                              </div>
                              <div>
                                <h5 className="mb-1 fw-bold cs-candidate-name">{getCandidateName(c)}</h5>
                                <small className="cs-candidate-party">{getCandidateParty(c)}</small>
                              </div>
                            </div>
                            <div className="party-logo-container">
                              <img
                                src={partyLogos[getCandidateParty(c)]}
                                alt={`${getCandidateParty(c)} Logo`}
                                className="party-logo rounded"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : hasRequestedCandidates ? (
                    <p className="cs-lock-subtitle mt-3">No candidates available for this election.</p>
                  ) : null}
                </>
              )}

              <div className="text-center mt-4">
                  <button
                    className="btn cs-auth-btn cs-action-btn btn-lg px-5 py-3 fw-bold"
                    onClick={handleVote}
                    disabled={loading || !selectedElectionId || !hasRequestedCandidates || !selectedCandidate}
                  >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting Vote...
                    </>
                  ) : (
                    "Submit Vote"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Vote;
