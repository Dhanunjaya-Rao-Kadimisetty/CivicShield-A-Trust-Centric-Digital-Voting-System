import { useState } from "react";
import EntryGate from "./pages/EntryGate";
import Login from "./pages/Login";
import OtpVerify from "./pages/OtpVerify";
import Vote from "./pages/Vote";
import Results from "./pages/Results";
import VoteVerify from "./pages/VoteVerify";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

import "./Styles/app.css";


function App() {
  const [step, setStep] = useState("entry"); // entry | login | otp | vote | results | verify | adminLogin | adminDashboard
  const [voterId, setVoterId] = useState("");

  return (
    <div>
      {step === "entry" && (
        <EntryGate
          onVoterLogin={() => setStep("login")}
          onAdminLogin={() => setStep("adminLogin")}
        />
      )}

      {step === "login" && (
        <Login setStep={setStep} setVoterId={setVoterId} />
      )}

      {step === "otp" && (
        <OtpVerify voterId={voterId} setStep={setStep} />
      )}

      {step === "vote" && (
        <Vote voterId={voterId} setStep={setStep} />
      )}

      {step === "results" && <Results setStep={setStep}/>}
      {step === "verify" && <VoteVerify />}

      {step === "adminLogin" && (
        <AdminLogin
          onBack={() => setStep("entry")}
          onSuccess={() => setStep("adminDashboard")}
        />
      )}

      {step === "adminDashboard" && (
        <AdminDashboard onLogout={() => setStep("entry")} />
      )}
    </div>
  );
}

export default App;
