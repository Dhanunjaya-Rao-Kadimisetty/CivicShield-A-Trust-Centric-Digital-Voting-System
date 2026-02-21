import React, { useCallback, useEffect, useMemo, useState } from "react";
import AppNavbar from "../components/AppNavbar";
import "../Styles/admin.css";

const API_BASE = "http://localhost:5000";

function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("elections");
  const [elections, setElections] = useState([]);
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [constituencies, setConstituencies] = useState([]);
  const [electionsLoading, setElectionsLoading] = useState(false);
  const [votersLoading, setVotersLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [constituenciesLoading, setConstituenciesLoading] = useState(false);
  const [statusClock, setStatusClock] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [editingElectionId, setEditingElectionId] = useState(null);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [expandedElectionId, setExpandedElectionId] = useState("");
  const [previewLoadingElectionId, setPreviewLoadingElectionId] = useState("");
  const [candidatePreviewByElectionId, setCandidatePreviewByElectionId] = useState({});
  const [newElection, setNewElection] = useState({
    name: "",
    electionType: "",
    description: "",
    startTime: "",
    endTime: ""
  });
  const [editElection, setEditElection] = useState({
    name: "",
    electionType: "",
    description: "",
    startTime: "",
    endTime: ""
  });
  const [newVoter, setNewVoter] = useState({
    voterId: "",
    phoneNumber: "",
    secretPin: "",
    fullName: "",
    address: "",
    constituencyId: "",
    isActive: true,
    accountStatus: "active"
  });
  const [newCandidate, setNewCandidate] = useState({
    electionId: "",
    candidateName: "",
    partyName: "",
    partyLogoUrl: "",
    constituencyId: "",
    constituencyName: "",
    constituencyState: "",
    isActive: true
  });
  const [editCandidate, setEditCandidate] = useState({
    candidateName: "",
    partyName: "",
    partyLogoUrl: "",
    constituencyId: "",
    isActive: true
  });

  const adminToken = localStorage.getItem("adminToken");

  const getElectionRecordId = (election) => String(election?.Id || election?.id || "");

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${adminToken}`
    };
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  }, [adminToken]);

  const loadElections = useCallback(async () => {
    try {
      setElectionsLoading(true);
      const response = await apiFetch("/admin/elections");
      const data = await response.json();
      if (data.success) {
        const loadedElections = data.data || [];
        setElections(loadedElections);
        if (loadedElections.length) {
          const fallbackElectionId = getElectionRecordId(loadedElections[0]);
          setSelectedElectionId((prevSelected) => {
            const stillExists = loadedElections.some(
              (election) => getElectionRecordId(election) === String(prevSelected || "")
            );
            const nextElectionId = stillExists ? String(prevSelected || "") : fallbackElectionId;
            setNewCandidate((prev) => ({ ...prev, electionId: nextElectionId }));
            return nextElectionId;
          });
        } else {
          setSelectedElectionId("");
          setNewCandidate((prev) => ({ ...prev, electionId: "" }));
        }
      } else {
        alert(data.message || "Failed to load elections");
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setElectionsLoading(false);
    }
  }, [apiFetch]);

  const loadVoters = useCallback(async (query = "") => {
    try {
      setVotersLoading(true);
      const url = query ? `/admin/voters?search=${encodeURIComponent(query)}` : "/admin/voters";
      const response = await apiFetch(url);
      const data = await response.json();
      if (data.success) {
        setVoters(data.data || []);
      } else {
        alert(data.message || "Failed to load voters");
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setVotersLoading(false);
    }
  }, [apiFetch]);

  const loadCandidates = useCallback(async (electionId) => {
    const normalizedElectionId = String(electionId || "").trim();
    if (!normalizedElectionId) {
      setCandidates([]);
      return;
    }

    try {
      setCandidatesLoading(true);
      const response = await apiFetch(`/admin/candidates?electionId=${encodeURIComponent(normalizedElectionId)}`);
      const data = await response.json();
      if (data.success) {
        const loadedCandidates = data.data || [];
        setCandidates(loadedCandidates);
        setCandidatePreviewByElectionId((prev) => ({
          ...prev,
          [normalizedElectionId]: loadedCandidates
        }));
      } else {
        alert(data.message || "Failed to load candidates");
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setCandidatesLoading(false);
    }
  }, [apiFetch]);

  const loadConstituencies = useCallback(async () => {
    try {
      setConstituenciesLoading(true);
      const response = await apiFetch("/admin/constituencies");
      const data = await response.json();
      if (data.success) {
        const loadedConstituencies = data.data || [];
        setConstituencies(loadedConstituencies);
        if (loadedConstituencies.length) {
          const firstConstituencyId = String(loadedConstituencies[0].Id || loadedConstituencies[0].id || "");
          setNewCandidate((prev) => ({
            ...prev,
            constituencyId: prev.constituencyId || firstConstituencyId
          }));
          setNewVoter((prev) => ({
            ...prev,
            constituencyId: prev.constituencyId || firstConstituencyId
          }));
        }
      } else {
        alert(data.message || "Failed to load constituencies");
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setConstituenciesLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!adminToken) {
      return;
    }
    loadElections();
    loadVoters();
    loadConstituencies();
  }, [adminToken, loadElections, loadVoters, loadConstituencies]);

  useEffect(() => {
    if (!adminToken || !selectedElectionId) {
      setCandidates([]);
      return;
    }
    loadCandidates(selectedElectionId);
  }, [adminToken, selectedElectionId, loadCandidates]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setStatusClock(Date.now());
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleElectionSubmit = async (event) => {
    event.preventDefault();
    if (!newElection.name.trim()) {
      alert("Election name is required");
      return;
    }
    if (!newElection.electionType.trim()) {
      alert("Election type is required");
      return;
    }
    if (!newElection.startTime) {
      alert("Start time is required");
      return;
    }
    if (!newElection.endTime) {
      alert("End time is required");
      return;
    }

    try {
      const response = await apiFetch("/admin/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newElection)
      });
      const data = await response.json();
      if (data.success) {
        alert("Election created");
        setNewElection({
          name: "",
          electionType: "",
          description: "",
          startTime: "",
          endTime: ""
        });
        loadElections();
      } else {
        alert(data.message || "Failed to create election");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const startElectionEdit = (election) => {
    setEditingElectionId(getElectionId(election));
    setEditElection({
      name: getElectionName(election) === "Untitled" ? "" : getElectionName(election),
      electionType: getElectionType(election),
      description: getElectionDescription(election) === "No description provided." ? "" : getElectionDescription(election),
      startTime: election.Start_time || election.start_time || election.Start_Date || election.start_date || "",
      endTime: election.End_time || election.end_time || election.End_Date || election.end_date || ""
    });
  };

  const cancelElectionEdit = () => {
    setEditingElectionId(null);
    setEditElection({
      name: "",
      electionType: "",
      description: "",
      startTime: "",
      endTime: ""
    });
  };

  const saveElectionEdit = async (electionId) => {
    if (!editElection.name.trim()) {
      alert("Election name is required");
      return;
    }

    try {
      const response = await apiFetch(`/admin/elections/${electionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editElection)
      });
      const data = await response.json();
      if (data.success) {
        alert("Election updated");
        cancelElectionEdit();
        loadElections();
      } else {
        alert(data.message || "Failed to update election");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const toggleElectionCandidatePreview = async (electionId) => {
    const normalizedElectionId = String(electionId || "").trim();
    if (!normalizedElectionId) {
      return;
    }

    if (expandedElectionId === normalizedElectionId) {
      setExpandedElectionId("");
      return;
    }

    setExpandedElectionId(normalizedElectionId);
    if (candidatePreviewByElectionId[normalizedElectionId]) {
      return;
    }

    try {
      setPreviewLoadingElectionId(normalizedElectionId);
      const response = await apiFetch(`/admin/candidates?electionId=${encodeURIComponent(normalizedElectionId)}`);
      const data = await response.json();
      if (data.success) {
        setCandidatePreviewByElectionId((prev) => ({
          ...prev,
          [normalizedElectionId]: data.data || []
        }));
      } else {
        alert(data.message || "Failed to load candidates");
      }
    } catch (error) {
      alert("Backend not reachable");
    } finally {
      setPreviewLoadingElectionId((prev) => (prev === normalizedElectionId ? "" : prev));
    }
  };

  const deleteElection = async (electionId) => {
    const confirmed = window.confirm("Delete this election? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/admin/elections/${electionId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        alert("Election deleted");
        const normalizedElectionId = String(electionId || "");
        setCandidatePreviewByElectionId((prev) => {
          const next = { ...prev };
          delete next[normalizedElectionId];
          return next;
        });
        setExpandedElectionId((prev) => (prev === normalizedElectionId ? "" : prev));
        if (editingElectionId === electionId) {
          cancelElectionEdit();
        }
        loadElections();
      } else {
        alert(data.message || "Failed to delete election");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const getElectionId = (election) => election.Id || election.id;
  const getElectionName = (election) =>
    election.Election_Name || election.election_name || election.Title || election.title || "Untitled";
  const getElectionType = (election) =>
    election.Election_type || election.election_type || election.Type || election.type || "";
  const getElectionDescription = (election) =>
    election.Description || election.description || "No description provided.";
  const getElectionStart = (election) =>
    election.Start_time || election.start_time || election.Start_Date || election.start_date || "";
  const getElectionEnd = (election) =>
    election.End_time || election.end_time || election.End_Date || election.end_date || "";
  const formatElectionDateTime = (value) => {
    if (!value) return "Not set";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not set";
    return parsed.toLocaleString();
  };
  const getElectionStatus = (election) => {
    const startRaw = getElectionStart(election);
    const endRaw = getElectionEnd(election);
    const fallbackStatus = String(election.Status || election.status || "inactive").toLowerCase();

    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    const now = new Date(statusClock);

    const hasValidStart = start && !Number.isNaN(start.getTime());
    const hasValidEnd = end && !Number.isNaN(end.getTime());

    if (hasValidStart && hasValidEnd && start > end) return "inactive";
    if (hasValidStart && now < start) return "scheduled";
    if (hasValidEnd && now > end) return "closed";
    if (hasValidStart && now >= start && (!hasValidEnd || now <= end)) return "active";
    if (!hasValidStart && hasValidEnd) return now <= end ? "active" : "closed";

    return fallbackStatus;
  };
  const getElectionStatusClassName = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "active") return "is-active";
    if (normalized === "scheduled") return "is-scheduled";
    if (normalized === "closed") return "is-closed";
    return "is-inactive";
  };
  const getVoterId = (voter) => voter.Id || voter.id;
  const getVoterUid = (voter) => voter.Voter_UId || voter.voter_uid || "N/A";
  const getVoterName = (voter) => voter.Voter_Name || voter.voter_name || "N/A";
  const getVoterPhone = (voter) => voter.Phone_number || voter.phone_number || "N/A";
  const getVoterAddress = (voter) => voter.Address || voter.address || "N/A";
  const getVoterConstituencyId = (voter) =>
    voter.Constituency_Id || voter.constituency_id || "N/A";
  const getVoterAccountStatus = (voter) =>
    voter.account_status || voter.Account_status || (voter.is_active === false ? "inactive" : "active");

  const getCandidateId = (candidate) => candidate.Id || candidate.id;
  const getCandidateName = (candidate) => candidate.Candidate_Name || candidate.candidate_name || "N/A";
  const getCandidateParty = (candidate) => candidate.Party_Name || candidate.party_name || "N/A";
  const getCandidatePartyLogo = (candidate) =>
    candidate.Party_Logo_Url || candidate.party_logo_url || candidate.Party_Logo || candidate.party_logo || "";
  const getCandidateConstituencyId = (candidate) =>
    candidate.Constituency_id || candidate.Constituency_Id || candidate.constituency_id || "N/A";
  const getCandidateIsActive = (candidate) =>
    candidate.Is_active === false || candidate.is_active === false ? false : true;
  const getConstituencyId = (constituency) => String(constituency?.Id || constituency?.id || "");
  const getConstituencyState = (constituency) =>
    String(
      constituency?.State ||
      constituency?.state ||
      constituency?.Constituency_State ||
      constituency?.constituency_state ||
      "NA"
    ).trim();
  const getStateCode = (state) => {
    const cleaned = String(state || "").replace(/[^A-Za-z ]/g, " ").trim();
    if (!cleaned) return "NA";
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase();
  };
  const computedStateWiseIdByConstituencyId = useMemo(() => {
    const sorted = [...constituencies].sort(
      (a, b) => Number(getConstituencyId(a) || 0) - Number(getConstituencyId(b) || 0)
    );
    const sequenceByState = new Map();
    const mapping = {};

    for (const constituency of sorted) {
      const id = getConstituencyId(constituency);
      if (!id) continue;
      const state = getConstituencyState(constituency) || "NA";
      const stateKey = state.toLowerCase();
      const nextIndex = (sequenceByState.get(stateKey) || 0) + 1;
      sequenceByState.set(stateKey, nextIndex);
      mapping[id] = `${getStateCode(state)}-${String(nextIndex).padStart(3, "0")}`;
    }

    return mapping;
  }, [constituencies]);
  const getConstituencyStateWiseId = (constituency) =>
    constituency?.StateWise_Id ||
    constituency?.statewise_id ||
    computedStateWiseIdByConstituencyId[getConstituencyId(constituency)] ||
    "";
  const getConstituencyName = (constituency) =>
    constituency?.Name || constituency?.name || constituency?.Constituency_Name || "Unnamed";
  const getConstituencyLabel = (constituency) => {
    const stateWiseId = getConstituencyStateWiseId(constituency);
    if (stateWiseId) {
      return `${stateWiseId} (${getConstituencyId(constituency)}) - ${getConstituencyName(constituency)}`;
    }
    return `${getConstituencyId(constituency)} - ${getConstituencyName(constituency)}`;
  };

  const handleVoterStatus = async (voterId, isActive) => {
    try {
      const response = await apiFetch(`/admin/voters/${voterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      const data = await response.json();
      if (data.success) {
        loadVoters(search);
      } else {
        alert(data.message || "Failed to update voter");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const handleCandidateCreate = async (event) => {
    event.preventDefault();
    if (!newCandidate.electionId) {
      alert("Select an election first");
      return;
    }
    if (!newCandidate.candidateName.trim() || !newCandidate.partyName.trim()) {
      alert("Candidate name and party name are required");
      return;
    }
    const normalizedConstituencyId = String(newCandidate.constituencyId || "").trim();
    const hasExistingConstituency =
      normalizedConstituencyId && Number(normalizedConstituencyId) > 0;
    const hasNewConstituency = newCandidate.constituencyName.trim();

    if (!hasExistingConstituency && !hasNewConstituency) {
      alert("Select a constituency or enter a new constituency name");
      return;
    }
    if (
      hasExistingConstituency &&
      !constituencies.some((item) => getConstituencyId(item) === normalizedConstituencyId)
    ) {
      alert("Selected constituency is not available");
      return;
    }
    if (!hasExistingConstituency && !newCandidate.constituencyState.trim()) {
      alert("State is required when creating a new constituency");
      return;
    }

    try {
      const response = await apiFetch("/admin/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCandidate)
      });
      const data = await response.json();
      if (data.success) {
        alert("Candidate created");
        setNewCandidate((prev) => ({
          ...prev,
          candidateName: "",
          partyName: "",
          partyLogoUrl: "",
          constituencyId: "",
          constituencyName: "",
          constituencyState: "",
          isActive: true
        }));
        loadConstituencies();
        loadCandidates(newCandidate.electionId);
      } else {
        alert(data.message || "Failed to create candidate");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const startCandidateEdit = (candidate) => {
    setEditingCandidateId(getCandidateId(candidate));
    setEditCandidate({
      candidateName: getCandidateName(candidate) === "N/A" ? "" : getCandidateName(candidate),
      partyName: getCandidateParty(candidate) === "N/A" ? "" : getCandidateParty(candidate),
      partyLogoUrl: getCandidatePartyLogo(candidate),
      constituencyId: String(getCandidateConstituencyId(candidate) === "N/A" ? "" : getCandidateConstituencyId(candidate)),
      isActive: getCandidateIsActive(candidate)
    });
  };

  const cancelCandidateEdit = () => {
    setEditingCandidateId(null);
    setEditCandidate({
      candidateName: "",
      partyName: "",
      partyLogoUrl: "",
      constituencyId: "",
      isActive: true
    });
  };

  const saveCandidateEdit = async (candidateId) => {
    if (!editCandidate.candidateName.trim() || !editCandidate.partyName.trim()) {
      alert("Candidate name and party name are required");
      return;
    }
    if (!editCandidate.constituencyId || Number(editCandidate.constituencyId) <= 0) {
      alert("Valid constituency ID is required");
      return;
    }
    if (!constituencies.some((item) => getConstituencyId(item) === String(editCandidate.constituencyId))) {
      alert("Selected constituency is not available");
      return;
    }

    try {
      const response = await apiFetch(`/admin/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCandidate)
      });
      const data = await response.json();
      if (data.success) {
        alert("Candidate updated");
        cancelCandidateEdit();
        loadCandidates(selectedElectionId);
      } else {
        alert(data.message || "Failed to update candidate");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const toggleCandidateActive = async (candidate) => {
    const candidateId = getCandidateId(candidate);
    const nextValue = !getCandidateIsActive(candidate);

    try {
      const response = await apiFetch(`/admin/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextValue })
      });
      const data = await response.json();
      if (data.success) {
        loadCandidates(selectedElectionId);
      } else {
        alert(data.message || "Failed to update candidate status");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const deleteCandidate = async (candidateId) => {
    const confirmed = window.confirm("Delete this candidate? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/admin/candidates/${candidateId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        alert("Candidate deleted");
        if (editingCandidateId === candidateId) {
          cancelCandidateEdit();
        }
        loadCandidates(selectedElectionId);
      } else {
        alert(data.message || "Failed to delete candidate");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const handleVoterCreate = async (event) => {
    event.preventDefault();
    if (!newVoter.voterId.trim() || !newVoter.phoneNumber.trim()) {
      alert("Voter ID and phone number are required");
      return;
    }
    if (!newVoter.fullName.trim()) {
      alert("Full name is required");
      return;
    }
    if (!newVoter.address.trim()) {
      alert("Address is required");
      return;
    }
    if (!newVoter.constituencyId || Number(newVoter.constituencyId) <= 0) {
      alert("Valid Constituency ID is required");
      return;
    }
    if (!constituencies.some((item) => getConstituencyId(item) === String(newVoter.constituencyId))) {
      alert("Selected constituency is not available");
      return;
    }

    try {
      const response = await apiFetch("/admin/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVoter)
      });
      const data = await response.json();
      if (data.success) {
        alert("Voter created");
        setNewVoter({
          voterId: "",
          phoneNumber: "",
          secretPin: "",
          fullName: "",
          address: "",
          constituencyId: "",
          isActive: true,
          accountStatus: "active"
        });
        loadVoters(search);
      } else {
        alert(data.message || "Failed to create voter");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const handleVoterDelete = async (voterId) => {
    const confirmed = window.confirm("Delete this voter? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/admin/voters/${voterId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        alert("Voter deleted");
        loadVoters(search);
      } else {
        alert(data.message || "Failed to delete voter");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadFile) {
      alert("Select an XLSX file first");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const response = await apiFetch("/admin/voters/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setUploadResult(data);
        const firstError = data.errors && data.errors.length ? ` First error: ${data.errors[0].reason}` : "";
        alert(`Upload complete. Inserted ${data.inserted}, failed ${data.failed}.${firstError}`);
        loadVoters();
      } else {
        alert(data.message || "Upload failed");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const handleDeleteAllVoters = async () => {
    const confirmed = window.confirm("Delete full voter dataset? This removes all voters.");
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch("/admin/voters?confirm=true", {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        alert(`All voters deleted (${data.deleted || 0})`);
        setVoters([]);
      } else {
        alert(data.message || "Failed to delete dataset");
      }
    } catch (error) {
      alert("Backend not reachable");
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/admin/logout", { method: "POST" });
    } catch (error) {
      // ignore
    }
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminEmployeeId");
    onLogout();
  };

  if (!adminToken) {
    return (
      <>
        <AppNavbar />
        <section className="cs-admin-shell">
          <div className="container">
            <div className="cs-admin-card">
              <h2>Admin session missing</h2>
              <p>Please login again to access the dashboard.</p>
              <button className="btn cs-admin-btn" type="button" onClick={onLogout}>
                Back to Login
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <AppNavbar />

      <section className="cs-admin-shell">
        <div className="container">
          <div className="cs-admin-header">
            <div>
              <h1>Admin Dashboard</h1>
              <p>Manage elections, voters, and live operations in one place.</p>
            </div>
            <button type="button" className="btn cs-admin-btn-outline" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <div className="cs-admin-tabs">
            <button
              type="button"
              className={`cs-admin-tab ${activeTab === "elections" ? "is-active" : ""}`}
              onClick={() => setActiveTab("elections")}
            >
              Elections
            </button>
            <button
              type="button"
              className={`cs-admin-tab ${activeTab === "voters" ? "is-active" : ""}`}
              onClick={() => setActiveTab("voters")}
            >
              Voters
            </button>
            <button
              type="button"
              className={`cs-admin-tab ${activeTab === "uploads" ? "is-active" : ""}`}
              onClick={() => setActiveTab("uploads")}
            >
              Uploads
            </button>
          </div>

          {activeTab === "elections" && (
            <>
              <div className="cs-admin-grid">
                <div className="cs-admin-panel">
                  <h2>Create Election</h2>
                  <form onSubmit={handleElectionSubmit} className="cs-admin-form">
                    <label>
                      Election Name
                    <input
                      type="text"
                      value={newElection.name}
                      required
                      onChange={(event) =>
                        setNewElection((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    </label>
                    <label>
                      Election Type
                    <input
                      type="text"
                      value={newElection.electionType}
                      required
                      onChange={(event) =>
                        setNewElection((prev) => ({ ...prev, electionType: event.target.value }))
                      }
                      placeholder="e.g. MP, MLA, Municipal"
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        rows="3"
                        value={newElection.description}
                        onChange={(event) =>
                          setNewElection((prev) => ({ ...prev, description: event.target.value }))
                        }
                      />
                    </label>
                    <div className="cs-admin-row">
                      <label>
                        Start Time
                        <input
                          type="datetime-local"
                          value={newElection.startTime}
                          required
                          onChange={(event) =>
                            setNewElection((prev) => ({ ...prev, startTime: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        End Time
                        <input
                          type="datetime-local"
                          value={newElection.endTime}
                          required
                          onChange={(event) =>
                            setNewElection((prev) => ({ ...prev, endTime: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <p className="cs-admin-muted">
                      Status is auto-calculated from Start Time and End Time.
                    </p>
                    <button type="submit" className="btn cs-admin-btn">
                      Create Election
                    </button>
                  </form>
                </div>

                <div className="cs-admin-panel">
                  <h2>Manage Elections</h2>
                  {electionsLoading ? (
                    <p className="cs-admin-muted">Loading elections...</p>
                  ) : elections.length ? (
                    <div className="cs-admin-list">
                      {elections.map((election) => (
                        <div className="cs-admin-list-item" key={getElectionId(election)}>
                          {editingElectionId === getElectionId(election) ? (
                            <div className="cs-admin-form cs-admin-inline-form">
                              <label>
                                Election Name
                                <input
                                  type="text"
                                  value={editElection.name}
                                  onChange={(event) =>
                                    setEditElection((prev) => ({ ...prev, name: event.target.value }))
                                  }
                                />
                              </label>
                              <label>
                                Election Type
                                <input
                                  type="text"
                                  value={editElection.electionType}
                                  onChange={(event) =>
                                    setEditElection((prev) => ({
                                      ...prev,
                                      electionType: event.target.value
                                    }))
                                  }
                                />
                              </label>
                              <label>
                                Description
                                <textarea
                                  rows="2"
                                  value={editElection.description}
                                  onChange={(event) =>
                                    setEditElection((prev) => ({
                                      ...prev,
                                      description: event.target.value
                                    }))
                                  }
                                />
                              </label>
                              <div className="cs-admin-row">
                                <label>
                                  Start Time
                                  <input
                                    type="datetime-local"
                                    value={editElection.startTime}
                                    onChange={(event) =>
                                      setEditElection((prev) => ({
                                        ...prev,
                                        startTime: event.target.value
                                      }))
                                    }
                                  />
                                </label>
                                <label>
                                  End Time
                                  <input
                                    type="datetime-local"
                                    value={editElection.endTime}
                                    onChange={(event) =>
                                      setEditElection((prev) => ({
                                        ...prev,
                                        endTime: event.target.value
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                              <p className="cs-admin-muted">
                                Status is auto-calculated from Start Time and End Time.
                              </p>
                              <div className="cs-admin-actions cs-admin-actions-inline">
                                <button
                                  type="button"
                                  className="btn cs-admin-btn"
                                  onClick={() => saveElectionEdit(getElectionId(election))}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline"
                                  onClick={cancelElectionEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="cs-admin-list-content cs-admin-election-info">
                                <div className="cs-admin-election-title-row">
                                  <h3>{getElectionName(election)}</h3>
                                  <span
                                    className={`cs-admin-election-status-pill ${getElectionStatusClassName(
                                      getElectionStatus(election)
                                    )}`}
                                  >
                                    {getElectionStatus(election)}
                                  </span>
                                </div>
                                <p>{getElectionDescription(election)}</p>
                                <div className="cs-admin-election-meta">
                                  <div className="cs-admin-election-meta-item">
                                    <span className="cs-admin-election-meta-label">Type</span>
                                    <span className="cs-admin-election-meta-value">
                                      {getElectionType(election) || "Not set"}
                                    </span>
                                  </div>
                                  <div className="cs-admin-election-meta-item">
                                    <span className="cs-admin-election-meta-label">Start</span>
                                    <span className="cs-admin-election-meta-value">
                                      {formatElectionDateTime(getElectionStart(election))}
                                    </span>
                                  </div>
                                  <div className="cs-admin-election-meta-item">
                                    <span className="cs-admin-election-meta-label">End</span>
                                    <span className="cs-admin-election-meta-value">
                                      {formatElectionDateTime(getElectionEnd(election))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="cs-admin-actions cs-admin-election-actions">
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline"
                                  onClick={() => toggleElectionCandidatePreview(getElectionId(election))}
                                >
                                  {expandedElectionId === String(getElectionId(election))
                                    ? "Hide Candidates"
                                    : "View Candidates"}
                                </button>
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline"
                                  onClick={() => startElectionEdit(election)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline cs-admin-danger"
                                  onClick={() => deleteElection(getElectionId(election))}
                                >
                                  Delete
                                </button>
                              </div>
                              {expandedElectionId === String(getElectionId(election)) ? (
                                <div className="cs-admin-list-content cs-admin-election-candidate-preview">
                                  <p className="cs-admin-election-candidate-title">Candidates</p>
                                  {previewLoadingElectionId === String(getElectionId(election)) ? (
                                    <p className="cs-admin-muted">Loading candidates...</p>
                                  ) : (candidatePreviewByElectionId[String(getElectionId(election))] || []).length ? (
                                    <div className="cs-admin-election-candidate-list">
                                      {(candidatePreviewByElectionId[String(getElectionId(election))] || []).map(
                                        (candidate) => (
                                          <p key={getCandidateId(candidate)}>
                                          {getCandidateName(candidate)} ({getCandidateParty(candidate)})
                                          </p>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="cs-admin-muted">No candidates in this election.</p>
                                  )}
                                </div>
                              ) : null}
                            </>
                          )}

                          </div>
                      ))}
                    </div>
                  ) : (
                    <p className="cs-admin-muted">No elections found.</p>
                  )}
                </div>
              </div>

              <div className="cs-admin-panel cs-admin-candidates-panel">
                <h2>Candidate Management</h2>
                {constituenciesLoading ? <p className="cs-admin-muted">Loading constituencies...</p> : null}
                <form onSubmit={handleCandidateCreate} className="cs-admin-form cs-admin-candidate-form">
                  <div className="cs-admin-row cs-admin-candidate-grid">
                    <label className="cs-admin-field">
                      Election
                      <select
                        value={newCandidate.electionId}
                        onChange={(event) => {
                          setNewCandidate((prev) => ({ ...prev, electionId: event.target.value }));
                          setSelectedElectionId(event.target.value);
                        }}
                      >
                        {!elections.length && <option value="">No elections available</option>}
                        {elections.map((election) => (
                          <option key={getElectionId(election)} value={String(getElectionId(election))}>
                            {getElectionName(election)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cs-admin-field">
                      Candidate Name
                      <input
                        type="text"
                        value={newCandidate.candidateName}
                        onChange={(event) =>
                          setNewCandidate((prev) => ({ ...prev, candidateName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="cs-admin-field">
                      Party Name
                      <input
                        type="text"
                        value={newCandidate.partyName}
                        onChange={(event) =>
                          setNewCandidate((prev) => ({ ...prev, partyName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="cs-admin-field">
                      Party Logo URL
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={newCandidate.partyLogoUrl}
                        onChange={(event) =>
                          setNewCandidate((prev) => ({ ...prev, partyLogoUrl: event.target.value }))
                        }
                      />
                    </label>
                    <label className="cs-admin-field">
                      Constituency ID
                      <select
                        value={newCandidate.constituencyId}
                        onChange={(event) =>
                          setNewCandidate((prev) => ({
                            ...prev,
                            constituencyId: event.target.value,
                            constituencyName: event.target.value ? "" : prev.constituencyName,
                            constituencyState: event.target.value ? "" : prev.constituencyState
                          }))
                        }
                      >
                        <option value="">Create new constituency</option>
                        {!constituencies.length && <option value="">No constituencies available</option>}
                        {constituencies.map((constituency) => (
                          <option key={getConstituencyId(constituency)} value={getConstituencyId(constituency)}>
                            {getConstituencyLabel(constituency)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {!newCandidate.constituencyId ? (
                      <div className="cs-admin-inline-constituency">
                        <p className="cs-admin-muted cs-admin-inline-title">Create new constituency</p>
                        <label className="cs-admin-field">
                          New Constituency Name
                          <input
                            type="text"
                            placeholder="e.g. Bheemili"
                            value={newCandidate.constituencyName}
                            onChange={(event) =>
                              setNewCandidate((prev) => ({
                                ...prev,
                                constituencyName: event.target.value
                              }))
                            }
                          />
                        </label>
                        <label className="cs-admin-field">
                          State
                          <input
                            type="text"
                            placeholder="e.g. Telangana"
                            value={newCandidate.constituencyState}
                            onChange={(event) =>
                              setNewCandidate((prev) => ({
                                ...prev,
                                constituencyState: event.target.value
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                  <button type="submit" className="btn cs-admin-btn">
                    Add Candidate
                  </button>
                </form>

                {candidatesLoading ? (
                  <p className="cs-admin-muted">Loading candidates...</p>
                ) : candidates.length ? (
                  <div className="cs-admin-table-scroll">
                    <div className="cs-admin-table cs-admin-table-candidates">
                      <div className="cs-admin-table-header">
                        <span>Name</span>
                        <span>Party</span>
                        <span>Logo</span>
                        <span>Constituency</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>
                      {candidates.map((candidate) => (
                        <div className="cs-admin-table-row" key={getCandidateId(candidate)}>
                          {editingCandidateId === getCandidateId(candidate) ? (
                            <>
                              <span>
                                <input
                                  type="text"
                                  value={editCandidate.candidateName}
                                  onChange={(event) =>
                                    setEditCandidate((prev) => ({
                                      ...prev,
                                      candidateName: event.target.value
                                    }))
                                  }
                                />
                              </span>
                              <span>
                                <input
                                  type="text"
                                  value={editCandidate.partyName}
                                  onChange={(event) =>
                                    setEditCandidate((prev) => ({ ...prev, partyName: event.target.value }))
                                  }
                                />
                              </span>
                              <span>
                                <input
                                  type="url"
                                  placeholder="https://example.com/logo.png"
                                  value={editCandidate.partyLogoUrl}
                                  onChange={(event) =>
                                    setEditCandidate((prev) => ({
                                      ...prev,
                                      partyLogoUrl: event.target.value
                                    }))
                                  }
                                />
                              </span>
                              <span>
                                <select
                                  value={editCandidate.constituencyId}
                                  onChange={(event) =>
                                    setEditCandidate((prev) => ({
                                      ...prev,
                                      constituencyId: event.target.value
                                    }))
                                  }
                                >
                                  {!constituencies.length && <option value="">No constituencies available</option>}
                                  {constituencies.map((constituency) => (
                                    <option key={getConstituencyId(constituency)} value={getConstituencyId(constituency)}>
                                      {getConstituencyLabel(constituency)}
                                    </option>
                                  ))}
                                </select>
                              </span>
                              <span>
                                <select
                                  value={editCandidate.isActive ? "true" : "false"}
                                  onChange={(event) =>
                                    setEditCandidate((prev) => ({
                                      ...prev,
                                      isActive: event.target.value === "true"
                                    }))
                                  }
                                >
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                              </span>
                              <span className="cs-admin-actions cs-admin-actions-inline">
                                <button
                                  type="button"
                                  className="btn cs-admin-btn"
                                  onClick={() => saveCandidateEdit(getCandidateId(candidate))}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline"
                                  onClick={cancelCandidateEdit}
                                >
                                  Cancel
                                </button>
                              </span>
                            </>
                          ) : (
                            <>
                              <span>{getCandidateName(candidate)}</span>
                              <span>{getCandidateParty(candidate)}</span>
                              <span>
                                {getCandidatePartyLogo(candidate) ? (
                                  <img
                                    className="cs-candidate-logo"
                                    src={getCandidatePartyLogo(candidate)}
                                    alt={`${getCandidateParty(candidate)} logo`}
                                  />
                                ) : (
                                  <span className="cs-admin-muted">No logo</span>
                                )}
                              </span>
                              <span>{getCandidateConstituencyId(candidate)}</span>
                              <span>{getCandidateIsActive(candidate) ? "Active" : "Inactive"}</span>
                              <span className="cs-admin-actions cs-admin-actions-inline">
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline"
                                  onClick={() => toggleCandidateActive(candidate)}
                                >
                                  {getCandidateIsActive(candidate) ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline"
                                  onClick={() => startCandidateEdit(candidate)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn cs-admin-btn-outline cs-admin-danger"
                                  onClick={() => deleteCandidate(getCandidateId(candidate))}
                                >
                                  Delete
                                </button>
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="cs-admin-muted">No candidates found for selected election.</p>
                )}
              </div>
            </>
          )}

          {activeTab === "voters" && (
            <div className="cs-admin-panel">
              <div className="cs-admin-panel-header">
                <h2>Voter Management</h2>
                <div className="cs-admin-search">
                  <input
                    type="text"
                    placeholder="Search by Voter ID or phone"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn cs-admin-btn"
                    onClick={() => loadVoters(search)}
                  >
                    Search
                  </button>
                </div>
              </div>

              <form onSubmit={handleVoterCreate} className="cs-admin-form cs-admin-voter-create">
                {constituenciesLoading ? <p className="cs-admin-muted">Loading constituencies...</p> : null}
                <div className="cs-admin-row">
                  <label>
                    Voter ID
                    <input
                      type="text"
                      value={newVoter.voterId}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, voterId: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      type="text"
                      value={newVoter.phoneNumber}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, phoneNumber: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="cs-admin-row">
                  <label>
                    Secret PIN
                    <input
                      type="text"
                      value={newVoter.secretPin}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, secretPin: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Full Name
                    <input
                      type="text"
                      value={newVoter.fullName}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="cs-admin-row">
                  <label>
                    Address
                    <input
                      type="text"
                      value={newVoter.address}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, address: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Constituency ID
                    <select
                      value={newVoter.constituencyId}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, constituencyId: event.target.value }))
                      }
                    >
                      {!constituencies.length && <option value="">No constituencies available</option>}
                      {constituencies.map((constituency) => (
                        <option key={getConstituencyId(constituency)} value={getConstituencyId(constituency)}>
                          {getConstituencyLabel(constituency)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="cs-admin-row">
                  <label>
                    Account Status
                    <select
                      value={newVoter.accountStatus}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, accountStatus: event.target.value }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="locked">Locked</option>
                    </select>
                  </label>
                  <label>
                    Active Flag
                    <select
                      value={newVoter.isActive ? "true" : "false"}
                      onChange={(event) =>
                        setNewVoter((prev) => ({ ...prev, isActive: event.target.value === "true" }))
                      }
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </label>
                </div>
                <button type="submit" className="btn cs-admin-btn">
                  Create Voter
                </button>
              </form>

              {votersLoading ? (
                <p className="cs-admin-muted">Loading voters...</p>
              ) : voters.length ? (
                <div className="cs-admin-table-scroll">
                  <div className="cs-admin-table cs-admin-table-voters">
                    <div className="cs-admin-table-header">
                      <span>Voter ID</span>
                      <span>Name</span>
                      <span>Phone</span>
                      <span>Address</span>
                      <span>Constituency</span>
                      <span>Account</span>
                      <span>Voted</span>
                      <span>Actions</span>
                    </div>
                    {voters.map((voter) => (
                      <div className="cs-admin-table-row" key={getVoterId(voter)}>
                        <span>{getVoterUid(voter)}</span>
                        <span>{getVoterName(voter)}</span>
                        <span>{getVoterPhone(voter)}</span>
                        <span>{getVoterAddress(voter)}</span>
                        <span>{getVoterConstituencyId(voter)}</span>
                        <span>{getVoterAccountStatus(voter)}</span>
                        <span>{voter.Has_voted || voter.has_voted ? "Yes" : "No"}</span>
                        <span className="cs-admin-actions cs-admin-actions-inline">
                          <button
                            type="button"
                            className="btn cs-admin-btn-outline"
                            onClick={() => handleVoterStatus(getVoterId(voter), voter.is_active === false)}
                          >
                            {voter.is_active === false ? "Activate" : "Deactivate"}
                          </button>
                          <button
                            type="button"
                            className="btn cs-admin-btn-outline cs-admin-danger"
                            onClick={() => handleVoterDelete(getVoterId(voter))}
                          >
                            Delete
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="cs-admin-muted">No voters found.</p>
              )}
            </div>
          )}

          {activeTab === "uploads" && (
            <div className="cs-admin-grid">
              <div className="cs-admin-panel">
                <h2>Upload Voter Dataset</h2>
                <form onSubmit={handleUpload} className="cs-admin-form">
                  <label>
                    XLSX File
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(event) => setUploadFile(event.target.files[0])}
                    />
                  </label>
                  <button type="submit" className="btn cs-admin-btn">
                    Upload Dataset
                  </button>
                  <button
                    type="button"
                    className="btn cs-admin-btn-outline cs-admin-danger"
                    onClick={handleDeleteAllVoters}
                  >
                    Delete Full Dataset
                  </button>
                </form>
                {uploadResult && (
                  <div className="cs-admin-upload-result">
                    <p>Inserted: {uploadResult.inserted}</p>
                    <p>Failed: {uploadResult.failed}</p>
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <div className="cs-admin-upload-errors">
                        <p>Sample errors:</p>
                        <ul className="cs-admin-guidelines">
                          {uploadResult.errors.slice(0, 5).map((errorItem, index) => (
                            <li key={`${errorItem.reason}-${index}`}>
                              {errorItem.row ? `Row ${errorItem.row}: ` : ""}
                              {errorItem.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="cs-admin-panel">
                <h2>Upload Guidance</h2>
                <ul className="cs-admin-guidelines">
                  <li>Required columns: Voter_UId, Voter_Name, Phone_number, Address, Constituency_Id.</li>
                  <li>Optional columns: Secret_PIN, account_status, lock_time.</li>
                  <li>Boolean fields: is_active, Has_voted.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default AdminDashboard;
