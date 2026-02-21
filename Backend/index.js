console.log(" BACKEND FILE INDEX.JS IS RUNNING ");
const express = require("express");
const cors = require("cors");
const app = express();
const crypto = require("crypto");
const multer = require("multer");
const xlsx = require("xlsx");

const { ethers } = require("ethers");
const voteLedgerArtifact = require("./abi/VoteLedger.json");

// 🔗 Ethereum connection (Ganache)
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");

// 🔑 Wallet (Ganache private key)
const wallet = new ethers.Wallet(
  "0xd413ee31cc2b7492468e7eec9d0b665fcb14ae1e192f2ca2fffc3f94913118ec",
  provider
);

provider.getBlockNumber()
  .then(b => console.log("✅ Connected to blockchain, block:", b))
  .catch(e => console.log("❌ Blockchain NOT reachable"));

// 📜 Smart contract instance

const contractAddress = "0x775AAc494801842EA6e8259C1cC23346F794da79";

console.log("Using contract address:", contractAddress);



const voteLedgerContract = new ethers.Contract(
  contractAddress,
  voteLedgerArtifact.abi,
  wallet
);


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 5000;
const pool = require("./db");

// Temporary OTP store (for project use)
const otpStore = {};
const adminSessions = new Map();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sanitizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeHeader = (value) =>
  sanitizeText(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const getTableColumns = async (tableName) => {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
};

const buildInsert = (tableName, row, allowedColumns) => {
  const columns = Object.keys(row).filter((key) => allowedColumns.includes(key));
  if (!columns.length) {
    return null;
  }
  const values = columns.map((col) => row[col]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  return {
    text: `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")})
           VALUES (${placeholders.join(", ")})`,
    values
  };
};

const buildUpdate = (tableName, row, allowedColumns, idColumn, idValue) => {
  const columns = Object.keys(row).filter((key) => allowedColumns.includes(key));
  if (!columns.length) {
    return null;
  }
  const setClauses = columns.map((col, index) => `"${col}" = $${index + 1}`);
  const values = columns.map((col) => row[col]);
  values.push(idValue);
  return {
    text: `UPDATE "${tableName}" SET ${setClauses.join(", ")} WHERE "${idColumn}" = $${
      columns.length + 1
    }`,
    values
  };
};

const resolveTableColumns = async (tableCandidates) => {
  for (const name of tableCandidates) {
    const columns = await getTableColumns(name);
    if (columns.length) {
      return { name, columns };
    }
  }
  return { name: tableCandidates[0], columns: [] };
};

const resolveTableByPattern = async (pattern) => {
  const result = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name ILIKE $1
     ORDER BY table_name ASC`,
    [pattern]
  );

  for (const row of result.rows) {
    const columns = await getTableColumns(row.table_name);
    if (columns.length) {
      return { name: row.table_name, columns };
    }
  }

  return null;
};

const pickFirstExistingColumn = (columns, candidates) =>
  candidates.find((name) => columns.includes(name));

const setIfProvided = (target, key, value) => {
  if (key && value !== undefined) {
    target[key] = value;
  }
};

const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ success: false, message: "Admin session required" });
  }

  const session = adminSessions.get(token);
  if (session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ success: false, message: "Admin session expired" });
  }

  req.admin = session;
  return next();
};

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
  res.send("Backend is running");
});

/* ---------------- LOGIN (VALIDATED) ---------------- */
app.post("/login", async (req, res) => {
  const { voterId, Phone } = req.body;

  if (!voterId || !Phone) {
    return res.status(400).json({
      success: false,
      message: "Voter ID and Phone Number are required",
    });
  }

  try {
    // Validate voter exists
    const voterResult = await pool.query(
      `SELECT "Id"
       FROM "Voters"
       WHERE "Voter_UId" = $1
         AND "Phone_number" = $2
         AND "is_active" = true`,
      [voterId, Phone]
    );

    console.log("Login attempt:", voterId, Phone);
    console.log("DB result:", voterResult.rows);

    if (voterResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "Invalid Voter ID or Phone Number",
      });
    }

    // ✅ Generate OTP locally (NO Fast2SMS)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // store OTP
    otpStore[voterId] = {
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000,
      attempts: 0,
      resendCount: 0,
      lastSentAt: Date.now(),
    };

    console.log("Generated OTP:", otp);

    // send OTP to frontend (for demo/testing)
    res.json({
      success: true,
      message: "OTP generated (demo mode)",
      voterId,
      otp   // only for temporary testing
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ---------------- VERIFY OTP ---------------- */
app.post("/verify-otp", (req, res) => {
  const { voterId, otp } = req.body;

  if (!voterId || !otp) {
    return res.status(400).json({
      success: false,
      message: "Voter ID and OTP are required"
    });
  }

  const record = otpStore[voterId];

  if (!record) {
    return res.json({
      success: false,
      message: "OTP session expired. Please login again."
    });
  }

  // ⏱️ Check expiry
  if (Date.now() > record.expiresAt) {
    delete otpStore[voterId];
    return res.json({
      success: false,
      message: "OTP expired. Please request a new OTP."
    });
  }

  // 🚨 Brute‑force protection
  if (record.attempts >= 3) {
    delete otpStore[voterId];
    return res.json({
      success: false,
      message: "Too many wrong attempts. OTP locked."
    });
  }

  // ❌ Wrong OTP
  if (record.otp !== otp) {
    record.attempts += 1;
    return res.json({
      success: false,
      message: "Invalid OTP"
    });
  }

  // ✅ Correct OTP
  delete otpStore[voterId];

  return res.json({
    success: true,
    message: "OTP verified successfully"
  });
});

app.post("/resend-otp", (req, res) => {
  const { voterId } = req.body;

  const record = otpStore[voterId];

  if (!record) {
    return res.json({
      success: false,
      message: "Session expired. Please login again."
    });
  }

  // ⏱️ Cooldown: 30 seconds
  if (Date.now() - record.lastSentAt < 30 * 1000) {
    return res.json({
      success: false,
      message: "Please wait before resending OTP."
    });
  }

  // 🚨 Resend limit
  if (record.resendCount >= 2) {
    delete otpStore[voterId];
    return res.json({
      success: false,
      message: "OTP resend limit exceeded."
    });
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

  record.otp = newOtp;
  record.expiresAt = Date.now() + 2 * 60 * 1000;
  record.resendCount += 1;
  record.lastSentAt = Date.now();

  console.log(`Resent OTP for ${voterId}: ${newOtp}`);

  return res.json({
    success: true,
    message: "OTP resent successfully",
    otp: newOtp
  });
});

/* ---------------- GET CANDIDATES ---------------- */
app.get("/candidates/:ElectionId", async (req, res) => {
  const electionId = req.params.ElectionId;

  try {
    const result = await pool.query(
      `SELECT * FROM candidates WHERE "Election_Id" = $1`,
      [electionId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/verify-pin", async (req, res) => {
  const { voterId, pin } = req.body;

  try {
    const result = await pool.query(
      `SELECT "Secret_PIN", "pin_attempts", "account_status"
       FROM "Voters"
       WHERE "Voter_UId" = $1`,
      [voterId]
    );

    if (!result.rows.length) {
      return res.json({ success: false, message: "Voter not found" });
    }

    const voter = result.rows[0];

    // 🔒 If already locked
    // 🔒 If locked — check auto unlock
if (voter.account_status === "locked") {

  const lockResult = await pool.query(
    `SELECT "lock_time" FROM "Voters" WHERE "Voter_UId" = $1`,
    [voterId]
  );

  const lockTime = lockResult.rows[0]?.lock_time;

  if (lockTime) {
    const now = new Date();
    const diffMinutes = (now - new Date(lockTime)) / (1000 * 60);

    // ⛔ still locked
    if (diffMinutes < 5) {
      return res.json({
        success: false,
        message: "Account locked. Try again after 5 minutes."
      });
    }

    // 🔓 auto unlock after 5 mins
    await pool.query(
      `UPDATE "Voters"
       SET "account_status"='active',
           "pin_attempts"=0
       WHERE "Voter_UId"=$1`,
      [voterId]
    );
    voter.account_status = "active";
    voter.pin_attempts = 0;

  }
}


    // ✅ Correct PIN
    if (voter.Secret_PIN === String(pin)) {
      await pool.query(
        `UPDATE "Voters"
         SET "pin_attempts" = 0
         WHERE "Voter_UId" = $1`,
        [voterId]
      );

      return res.json({
        success: true,
        message: "PIN verified successfully"
      });
    }

    // ❌ Wrong PIN
    let attempts = voter.pin_attempts + 1;

    if (attempts >= 3) {
      await pool.query(
        `UPDATE "Voters"
         SET "pin_attempts" = $1,
             "account_status" = 'locked',
             "lock_time" = NOW()
         WHERE "Voter_UId" = $2`,
        [attempts, voterId]
      );

      return res.json({
        success: false,
        message: "Account locked after 3 failed PIN attempts"
      });
    }

    await pool.query(
      `UPDATE "Voters"
       SET "pin_attempts" = $1
       WHERE "Voter_UId" = $2`,
      [attempts, voterId]
    );

    return res.json({
      success: false,
      message: `Invalid PIN. Attempts left: ${3 - attempts}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


  

app.post("/vote", async (req, res) => {
  const { voterId, electionId, candidateId, pin } = req.body;
  // 🔐 PIN validation before vote
const pinCheck = await pool.query(
  `SELECT "Secret_PIN", "account_status"
   FROM "Voters"
   WHERE "Voter_UId" = $1`,
  [voterId]
);

if (pinCheck.rows[0].account_status === "locked") {
  return res.status(403).json({
    success: false,
    message: "Account locked due to multiple wrong PIN attempts"
  });
}

if (String(pinCheck.rows[0].Secret_PIN) !== String(pin)) {
  return res.status(403).json({
    success: false,
    message: "PIN verification failed. Vote blocked"
  });
}
  console.log("🗳️ /vote API HIT:", req.body);

  if (!voterId || !electionId || !candidateId) {
    return res.status(400).json({
      success: false,
      message: "Voter ID, Election ID, and Candidate ID are required",
    });
  }

  try {
    // 1️⃣ Fetch voter
    const voterResult = await pool.query(
      `SELECT "Id", "Has_voted"
       FROM "Voters"
       WHERE "Voter_UId" = $1`,
      [voterId]
    );

    if (voterResult.rows.length === 0) {
      return res.json({ success: false, message: "Voter not found" });
    }

    const voterDbId = voterResult.rows[0].Id;

    if (voterResult.rows[0].Has_voted) {
      return res.json({ success: false, message: "You have already voted" });
    }

    // 2️⃣ Check blockchain availability
    await provider.getBlockNumber();

    // 3️⃣ Generate UNIQUE receipt hash
    const receiptData = `${voterDbId}-${electionId}-${candidateId}-${Date.now()}`;
    const receiptHash = ethers.keccak256(
      ethers.toUtf8Bytes(receiptData)
    );

    console.log("🔐 Generated receiptHash:", receiptHash);
    console.log("📍 Contract used:", voteLedgerContract.target);

    // 4️⃣ Store vote on blockchain (CRITICAL STEP)
    const tx = await voteLedgerContract.storeVote(receiptHash);
    const receipt = await tx.wait();

    console.log("⛓️ Vote stored on blockchain");
    console.log("📦 Block:", receipt.blockNumber);

    // 5️⃣ DB operations (best‑effort only)
    try {
      await pool.query(
        `INSERT INTO votes ("Voter_id", "Election_id", "candidate_id")
         VALUES ($1, $2, $3)`,
        [voterDbId, electionId, candidateId]
      );

      await pool.query(
        `UPDATE "Voters"
         SET "Has_voted" = true
         WHERE "Id" = $1`,
        [voterDbId]
      );
    } catch (dbError) {
      console.error("⚠️ DB error AFTER blockchain success:", dbError);
      // DO NOT fail the vote
    }

    // 6️⃣ ALWAYS return success if blockchain succeeded
    return res.json({
      success: true,
      message: "Vote cast successfully",
      receiptHash,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });

  } catch (error) {
    console.error("❌ Vote API error FULL:", error);

    // 🔍 show revert reason if any
    if (error.reason) {
      console.error("🔴 REVERT REASON:", error.reason);
    }

    return res.status(500).json({
      success: false,
      message: error.reason || "Vote failed. Please try again.",
    });
  }
});


/* ---------------- RESULTS ---------------- */
app.get("/results/:ElectionId", async (req, res) => {
  const electionId = req.params.ElectionId;

  try {
    const result = await pool.query(
      `
      SELECT
        c."Id" AS candidate_id,
        c."Candidate_Name",
        c."Party_Name",
        COUNT(v."Id") AS total_votes
      FROM candidates c
      LEFT JOIN votes v ON c."Id" = v."candidate_id"
      WHERE c."Election_Id" = $1
      GROUP BY c."Id"
      ORDER BY total_votes DESC
      `,
      [electionId]
    );

    res.json({
      success: true,
      results: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/verify-vote", async (req, res) => {
  try {
    const { transactionHash } = req.body;

    if (!transactionHash) {
      return res.json({ success: false, verified: false });
    }

    console.log("🔍 Verifying via tx receipt:", transactionHash);

    const receipt = await provider.getTransactionReceipt(transactionHash);

    if (!receipt) {
      return res.json({ success: true, verified: false });
    }

    // Optional safety checks
    const isCorrectContract =
      receipt.to?.toLowerCase() ===
      "0x775AAc494801842EA6e8259C1cC23346F794da79".toLowerCase();

    return res.json({
      success: true,
      verified: receipt.status === 1 && isCorrectContract,
    });

  } catch (err) {
    console.error("❌ TX verification error:", err);
    return res.status(500).json({
      success: false,
      verified: false,
    });
  }
});

/* ---------------- ADMIN AUTH ---------------- */
app.post("/admin/login", async (req, res) => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    return res.status(400).json({
      success: false,
      message: "Employee ID and password are required"
    });
  }

  try {
    let table = await resolveTableColumns(["Admins", "admins", "Admin", "admin"]);
    if (!table.columns.length) {
      const discovered = await resolveTableByPattern("%admin%");
      if (discovered) {
        table = discovered;
      }
    }
    if (!table.columns.length) {
      return res.status(500).json({
        success: false,
        message: "Admins table not found. Create a table like admins/admin."
      });
    }

    const idColumn = pickFirstExistingColumn(table.columns, ["Id", "id"]);
    const employeeIdColumn = pickFirstExistingColumn(table.columns, [
      "Employee_Id",
      "employee_id",
      "employeeid"
    ]);
    const passwordColumn = pickFirstExistingColumn(table.columns, [
      "Password",
      "password",
      "Pin",
      "pin",
      "Secret_PIN",
      "secret_pin"
    ]);
    const fullNameColumn = pickFirstExistingColumn(table.columns, [
      "Full_Name",
      "full_name",
      "name"
    ]);
    const roleColumn = pickFirstExistingColumn(table.columns, ["Role", "role"]);
    const isActiveColumn = pickFirstExistingColumn(table.columns, [
      "is_active",
      "Is_active",
      "active"
    ]);

    if (!idColumn || !employeeIdColumn || !passwordColumn) {
      return res.status(500).json({
        success: false,
        message: "Admins table is missing required columns"
      });
    }

    const selectFields = [
      `"${idColumn}" AS id`,
      `"${employeeIdColumn}" AS employee_id`,
      `"${passwordColumn}" AS password`,
      fullNameColumn ? `"${fullNameColumn}" AS full_name` : `NULL::text AS full_name`,
      roleColumn ? `"${roleColumn}" AS role` : `NULL::text AS role`,
      isActiveColumn ? `"${isActiveColumn}" AS is_active` : `TRUE AS is_active`
    ];

    const adminResult = await pool.query(
      `SELECT ${selectFields.join(", ")}
       FROM "${table.name}"
       WHERE "${employeeIdColumn}" = $1`,
      [employeeId]
    );

    if (!adminResult.rows.length) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const admin = adminResult.rows[0];

    const isActive =
      admin.is_active === false ||
      String(admin.is_active).toLowerCase() === "false" ||
      String(admin.is_active) === "0"
        ? false
        : true;

    if (!isActive) {
      return res.status(403).json({ success: false, message: "Admin account disabled" });
    }

    if (String(admin.password) !== String(password)) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    adminSessions.set(token, {
      adminId: admin.id,
      employeeId: admin.employee_id,
      fullName: admin.full_name || "",
      role: admin.role || "admin",
      expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
    });

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        employeeId: admin.employee_id,
        fullName: admin.full_name || "",
        role: admin.role || "admin"
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    adminSessions.delete(token);
  }
  return res.json({ success: true, message: "Logged out" });
});

app.get("/admin/profile", requireAdmin, (req, res) => {
  return res.json({ success: true, admin: req.admin });
});

/* ---------------- ADMIN ELECTIONS ---------------- */
app.get("/admin/elections", requireAdmin, async (req, res) => {
  try {
    const table = await resolveTableColumns(["Elections", "elections"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Elections table not found" });
    }

    const result = await pool.query(
      `SELECT * FROM "${table.name}" ORDER BY "Id" DESC`
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Admin elections error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/elections", requireAdmin, async (req, res) => {
  const {
    name,
    title,
    electionType,
    type,
    description,
    startDate,
    endDate,
    startTime,
    endTime,
    status,
    metadata
  } = req.body;

  try {
    const table = await resolveTableColumns(["Elections", "elections"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Elections table not found" });
    }

    const row = {};
    const electionName = sanitizeText(name) || sanitizeText(title);
    const normalizedType = sanitizeText(electionType) || sanitizeText(type);

    const nameColumn = pickFirstExistingColumn(table.columns, [
      "Election_Name",
      "election_name",
      "Title",
      "title"
    ]);
    const titleColumn = pickFirstExistingColumn(table.columns, ["Title", "title"]);
    const typeColumn = pickFirstExistingColumn(table.columns, [
      "Election_type",
      "election_type",
      "Type",
      "type"
    ]);
    const descriptionColumn = pickFirstExistingColumn(table.columns, [
      "Description",
      "description"
    ]);
    const startColumn = pickFirstExistingColumn(table.columns, [
      "Start_time",
      "start_time",
      "Start_Date",
      "start_date"
    ]);
    const endColumn = pickFirstExistingColumn(table.columns, [
      "End_time",
      "end_time",
      "End_Date",
      "end_date"
    ]);
    const statusColumn = pickFirstExistingColumn(table.columns, ["Status", "status"]);
    const metadataColumn = pickFirstExistingColumn(table.columns, ["Metadata", "metadata"]);

    setIfProvided(row, nameColumn, electionName || undefined);
    setIfProvided(row, titleColumn, sanitizeText(title) || sanitizeText(name) || undefined);
    setIfProvided(row, typeColumn, normalizedType || undefined);
    setIfProvided(row, descriptionColumn, sanitizeText(description) || undefined);
    setIfProvided(row, startColumn, startDate || startTime || undefined);
    setIfProvided(row, endColumn, endDate || endTime || undefined);
    setIfProvided(row, statusColumn, sanitizeText(status) || "draft");
    setIfProvided(row, metadataColumn, metadata ? JSON.stringify(metadata) : undefined);

    const query = buildInsert(table.name, row, table.columns);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to insert" });
    }

    const requiredInfo = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND is_nullable = 'NO'
         AND column_default IS NULL`,
      [table.name]
    );
    const missingColumns = requiredInfo.rows
      .map((r) => r.column_name)
      .filter((column) => row[column] === undefined || row[column] === null || row[column] === "");

    if (missingColumns.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingColumns.join(", ")}`
      });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin create election error:", error);
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

app.get("/admin/elections/:id", requireAdmin, async (req, res) => {
  const electionId = req.params.id;
  try {
    const table = await resolveTableColumns(["Elections", "elections"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Elections table not found" });
    }

    const result = await pool.query(
      `SELECT * FROM "${table.name}" WHERE "Id" = $1`,
      [electionId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin get election error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.patch("/admin/elections/:id", requireAdmin, async (req, res) => {
  const electionId = req.params.id;
  const {
    name,
    title,
    electionType,
    type,
    description,
    startDate,
    endDate,
    startTime,
    endTime,
    status,
    metadata
  } = req.body;

  try {
    const table = await resolveTableColumns(["Elections", "elections"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Elections table not found" });
    }

    const row = {};
    const hasName = Object.prototype.hasOwnProperty.call(req.body, "name");
    const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
    const hasType =
      Object.prototype.hasOwnProperty.call(req.body, "electionType") ||
      Object.prototype.hasOwnProperty.call(req.body, "type");
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");
    const hasStart =
      Object.prototype.hasOwnProperty.call(req.body, "startDate") ||
      Object.prototype.hasOwnProperty.call(req.body, "startTime");
    const hasEnd =
      Object.prototype.hasOwnProperty.call(req.body, "endDate") ||
      Object.prototype.hasOwnProperty.call(req.body, "endTime");
    const hasStatus = Object.prototype.hasOwnProperty.call(req.body, "status");
    const hasMetadata = Object.prototype.hasOwnProperty.call(req.body, "metadata");

    const electionName = sanitizeText(name) || sanitizeText(title);
    const normalizedType = sanitizeText(electionType) || sanitizeText(type);

    const nameColumn = pickFirstExistingColumn(table.columns, [
      "Election_Name",
      "election_name",
      "Title",
      "title"
    ]);
    const titleColumn = pickFirstExistingColumn(table.columns, ["Title", "title"]);
    const typeColumn = pickFirstExistingColumn(table.columns, [
      "Election_type",
      "election_type",
      "Type",
      "type"
    ]);
    const descriptionColumn = pickFirstExistingColumn(table.columns, [
      "Description",
      "description"
    ]);
    const startColumn = pickFirstExistingColumn(table.columns, [
      "Start_time",
      "start_time",
      "Start_Date",
      "start_date"
    ]);
    const endColumn = pickFirstExistingColumn(table.columns, [
      "End_time",
      "end_time",
      "End_Date",
      "end_date"
    ]);
    const statusColumn = pickFirstExistingColumn(table.columns, ["Status", "status"]);
    const metadataColumn = pickFirstExistingColumn(table.columns, ["Metadata", "metadata"]);

    if (hasName || hasTitle) {
      setIfProvided(row, nameColumn, electionName || null);
      setIfProvided(row, titleColumn, sanitizeText(title) || sanitizeText(name) || null);
    }
    if (hasType) {
      setIfProvided(row, typeColumn, normalizedType || null);
    }
    if (hasDescription) {
      setIfProvided(row, descriptionColumn, sanitizeText(description) || null);
    }
    if (hasStart) {
      setIfProvided(row, startColumn, startDate || startTime || null);
    }
    if (hasEnd) {
      setIfProvided(row, endColumn, endDate || endTime || null);
    }
    if (hasStatus) {
      setIfProvided(row, statusColumn, sanitizeText(status) || null);
    }
    if (hasMetadata) {
      setIfProvided(row, metadataColumn, metadata ? JSON.stringify(metadata) : null);
    }

    const query = buildUpdate(table.name, row, table.columns, "Id", electionId);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin update election error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/admin/elections/:id", requireAdmin, async (req, res) => {
  const electionId = req.params.id;
  try {
    const table = await resolveTableColumns(["Elections", "elections"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Elections table not found" });
    }

    await pool.query(
      `DELETE FROM "${table.name}" WHERE "Id" = $1`,
      [electionId]
    );

    return res.json({ success: true, message: "Election deleted" });
  } catch (error) {
    console.error("Admin delete election error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- ADMIN CONSTITUENCIES ---------------- */
app.get("/admin/constituencies", requireAdmin, async (req, res) => {
  try {
    const table = await resolveTableColumns(["constituencies", "Constituencies"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Constituencies table not found" });
    }

    const result = await pool.query(`SELECT * FROM "${table.name}" ORDER BY "Id" ASC`);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Admin constituencies error:", error);
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

app.post("/admin/constituencies", requireAdmin, async (req, res) => {
  const { name, constituencyName, state, constituencyState, isActive } = req.body;

  try {
    const table = await resolveTableColumns(["constituencies", "Constituencies"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Constituencies table not found" });
    }

    const nameColumn = pickFirstExistingColumn(table.columns, [
      "Name",
      "name",
      "Constituency_Name",
      "constituency_name",
      "Title",
      "title"
    ]);
    const activeColumn = pickFirstExistingColumn(table.columns, ["Is_active", "is_active", "Active", "active"]);
    const stateColumn = pickFirstExistingColumn(table.columns, ["State", "state"]);

    if (!nameColumn) {
      return res.status(500).json({
        success: false,
        message: "Constituencies table is missing a name column"
      });
    }

    const normalizedName = sanitizeText(name) || sanitizeText(constituencyName);
    if (!normalizedName) {
      return res.status(400).json({ success: false, message: "Constituency name is required" });
    }

    const row = {};
    row[nameColumn] = normalizedName;
    setIfProvided(row, stateColumn, sanitizeText(state) || sanitizeText(constituencyState) || undefined);
    setIfProvided(row, activeColumn, typeof isActive === "boolean" ? isActive : true);

    const requiredInfo = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND is_nullable = 'NO'
         AND column_default IS NULL`,
      [table.name]
    );
    const missingColumns = requiredInfo.rows
      .map((r) => r.column_name)
      .filter((column) => row[column] === undefined || row[column] === null || row[column] === "");

    if (missingColumns.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingColumns.join(", ")}`
      });
    }

    const query = buildInsert(table.name, row, table.columns);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to insert" });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin create constituency error:", error);
    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Constituency already exists"
      });
    }
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

/* ---------------- ADMIN CANDIDATES ---------------- */
app.get("/admin/candidates", requireAdmin, async (req, res) => {
  const electionId = sanitizeText(req.query.electionId);
  try {
    const table = await resolveTableColumns(["Candidates", "candidates"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Candidates table not found" });
    }

    const electionIdColumn = pickFirstExistingColumn(table.columns, ["Election_Id", "election_id"]);
    let queryText = `SELECT * FROM "${table.name}"`;
    const values = [];

    if (electionId && electionIdColumn) {
      values.push(electionId);
      queryText += ` WHERE "${electionIdColumn}" = $1`;
    }

    queryText += ` ORDER BY "Id" DESC LIMIT 500`;
    const result = await pool.query(queryText, values);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Admin candidates error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/candidates", requireAdmin, async (req, res) => {
  const {
    candidateName,
    partyName,
    partyLogoUrl,
    electionId,
    constituencyId,
    constituencyName,
    constituencyState,
    isActive
  } = req.body;

  try {
    const table = await resolveTableColumns(["Candidates", "candidates"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Candidates table not found" });
    }

    const row = {};
    const candidateNameColumn = pickFirstExistingColumn(table.columns, [
      "Candidate_Name",
      "candidate_name",
      "Name",
      "name"
    ]);
    const partyColumn = pickFirstExistingColumn(table.columns, ["Party_Name", "party_name"]);
    const partyLogoColumn = pickFirstExistingColumn(table.columns, [
      "Party_Logo_Url",
      "party_logo_url",
      "Party_Logo",
      "party_logo"
    ]);
    const electionIdColumn = pickFirstExistingColumn(table.columns, ["Election_Id", "election_id"]);
    const constituencyColumn = pickFirstExistingColumn(table.columns, [
      "Constituency_id",
      "Constituency_Id",
      "constituency_id"
    ]);
    const activeColumn = pickFirstExistingColumn(table.columns, ["Is_active", "is_active"]);

    setIfProvided(row, candidateNameColumn, sanitizeText(candidateName) || undefined);
    setIfProvided(row, partyColumn, sanitizeText(partyName) || undefined);
    setIfProvided(row, partyLogoColumn, sanitizeText(partyLogoUrl) || undefined);

    if (electionIdColumn) {
      const normalizedElectionId = sanitizeText(electionId);
      if (normalizedElectionId) {
        const parsedElectionId = Number(normalizedElectionId);
        if (!Number.isFinite(parsedElectionId)) {
          return res.status(400).json({
            success: false,
            message: "Election ID must be a number"
          });
        }
        row[electionIdColumn] = parsedElectionId;
      }
    }

    if (constituencyColumn) {
      const normalizedConstituencyId = sanitizeText(constituencyId);

      if (normalizedConstituencyId) {
        const parsedConstituency = Number(normalizedConstituencyId);
        if (!Number.isFinite(parsedConstituency)) {
          return res.status(400).json({
            success: false,
            message: "Constituency ID must be a number"
          });
        }
        row[constituencyColumn] = parsedConstituency;
      } else {
        const normalizedConstituencyName = sanitizeText(constituencyName);
        const normalizedConstituencyState = sanitizeText(constituencyState);

        if (normalizedConstituencyName) {
          const constituencyTable = await resolveTableColumns(["constituencies", "Constituencies"]);
          if (!constituencyTable.columns.length) {
            return res.status(500).json({
              success: false,
              message: "Constituencies table not found"
            });
          }

          const constituencyIdColumn = pickFirstExistingColumn(constituencyTable.columns, [
            "Id",
            "id",
            "Constituency_id",
            "Constituency_Id",
            "constituency_id"
          ]);
          const constituencyNameColumn = pickFirstExistingColumn(constituencyTable.columns, [
            "Name",
            "name",
            "Constituency_Name",
            "constituency_name",
            "Title",
            "title"
          ]);
          const constituencyStateColumn = pickFirstExistingColumn(constituencyTable.columns, ["State", "state"]);
          const constituencyActiveColumn = pickFirstExistingColumn(constituencyTable.columns, [
            "Is_active",
            "is_active",
            "Active",
            "active"
          ]);

          if (!constituencyIdColumn || !constituencyNameColumn) {
            return res.status(500).json({
              success: false,
              message: "Constituencies table is missing required columns"
            });
          }

          if (constituencyStateColumn && !normalizedConstituencyState) {
            return res.status(400).json({
              success: false,
              message: "State is required for new constituency"
            });
          }

          let existingConstituencyResult;
          if (constituencyStateColumn) {
            existingConstituencyResult = await pool.query(
              `SELECT "${constituencyIdColumn}" AS id
               FROM "${constituencyTable.name}"
               WHERE LOWER("${constituencyNameColumn}") = LOWER($1)
                 AND LOWER("${constituencyStateColumn}") = LOWER($2)
               LIMIT 1`,
              [normalizedConstituencyName, normalizedConstituencyState]
            );
          } else {
            existingConstituencyResult = await pool.query(
              `SELECT "${constituencyIdColumn}" AS id
               FROM "${constituencyTable.name}"
               WHERE LOWER("${constituencyNameColumn}") = LOWER($1)
               LIMIT 1`,
              [normalizedConstituencyName]
            );
          }

          let resolvedConstituencyId = existingConstituencyResult.rows[0]?.id;

          if (!resolvedConstituencyId) {
            const constituencyRow = {};
            constituencyRow[constituencyNameColumn] = normalizedConstituencyName;
            setIfProvided(constituencyRow, constituencyStateColumn, normalizedConstituencyState || undefined);
            setIfProvided(constituencyRow, constituencyActiveColumn, true);

            const constituencyRequired = await pool.query(
              `SELECT column_name
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = $1
                 AND is_nullable = 'NO'
                 AND column_default IS NULL`,
              [constituencyTable.name]
            );
            const missingConstituencyColumns = constituencyRequired.rows
              .map((r) => r.column_name)
              .filter(
                (column) =>
                  constituencyRow[column] === undefined ||
                  constituencyRow[column] === null ||
                  constituencyRow[column] === ""
              );

            if (missingConstituencyColumns.length) {
              return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingConstituencyColumns.join(", ")}`
              });
            }

            const constituencyInsert = buildInsert(
              constituencyTable.name,
              constituencyRow,
              constituencyTable.columns
            );
            if (!constituencyInsert) {
              return res.status(400).json({
                success: false,
                message: "Unable to create constituency with provided values"
              });
            }

            constituencyInsert.text += ` RETURNING "${constituencyIdColumn}" AS id`;
            const constituencyInsertResult = await pool.query(
              constituencyInsert.text,
              constituencyInsert.values
            );
            resolvedConstituencyId = constituencyInsertResult.rows[0]?.id;
          }

          if (resolvedConstituencyId !== undefined && resolvedConstituencyId !== null) {
            const parsedResolvedConstituencyId = Number(resolvedConstituencyId);
            if (!Number.isFinite(parsedResolvedConstituencyId)) {
              return res.status(500).json({
                success: false,
                message: "Resolved constituency ID is invalid"
              });
            }
            row[constituencyColumn] = parsedResolvedConstituencyId;
          }
        }
      }
    }

    if (constituencyColumn && (row[constituencyColumn] === undefined || row[constituencyColumn] === null)) {
      return res.status(400).json({
        success: false,
        message:
          "Constituency is required. Select an existing constituency or provide valid new constituency details."
      });
    }

    setIfProvided(row, activeColumn, typeof isActive === "boolean" ? isActive : true);

    const requiredInfo = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND is_nullable = 'NO'
         AND column_default IS NULL`,
      [table.name]
    );
    const missingColumns = requiredInfo.rows
      .map((r) => r.column_name)
      .filter((column) => row[column] === undefined || row[column] === null || row[column] === "");

    if (missingColumns.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingColumns.join(", ")}`
      });
    }

    const query = buildInsert(table.name, row, table.columns);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to insert" });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin create candidate error:", error);
    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid election or constituency. Select values that exist in master tables."
      });
    }
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

app.patch("/admin/candidates/:id", requireAdmin, async (req, res) => {
  const candidateId = req.params.id;
  const { candidateName, partyName, partyLogoUrl, constituencyId, electionId, isActive } = req.body;

  try {
    const table = await resolveTableColumns(["Candidates", "candidates"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Candidates table not found" });
    }

    const row = {};
    const candidateNameColumn = pickFirstExistingColumn(table.columns, [
      "Candidate_Name",
      "candidate_name",
      "Name",
      "name"
    ]);
    const partyColumn = pickFirstExistingColumn(table.columns, ["Party_Name", "party_name"]);
    const partyLogoColumn = pickFirstExistingColumn(table.columns, [
      "Party_Logo_Url",
      "party_logo_url",
      "Party_Logo",
      "party_logo"
    ]);
    const electionIdColumn = pickFirstExistingColumn(table.columns, ["Election_Id", "election_id"]);
    const constituencyColumn = pickFirstExistingColumn(table.columns, [
      "Constituency_id",
      "Constituency_Id",
      "constituency_id"
    ]);
    const activeColumn = pickFirstExistingColumn(table.columns, ["Is_active", "is_active"]);

    if (Object.prototype.hasOwnProperty.call(req.body, "candidateName")) {
      setIfProvided(row, candidateNameColumn, sanitizeText(candidateName) || null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "partyName")) {
      setIfProvided(row, partyColumn, sanitizeText(partyName) || null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "partyLogoUrl")) {
      setIfProvided(row, partyLogoColumn, sanitizeText(partyLogoUrl) || null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "electionId") && electionIdColumn) {
      const normalizedElectionId = sanitizeText(electionId);
      if (!normalizedElectionId) {
        row[electionIdColumn] = null;
      } else {
        const parsedElectionId = Number(normalizedElectionId);
        if (!Number.isFinite(parsedElectionId)) {
          return res.status(400).json({
            success: false,
            message: "Election ID must be a number"
          });
        }
        row[electionIdColumn] = parsedElectionId;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "constituencyId") && constituencyColumn) {
      const normalizedConstituency = sanitizeText(constituencyId);
      if (!normalizedConstituency) {
        row[constituencyColumn] = null;
      } else {
        const parsedConstituency = Number(normalizedConstituency);
        if (!Number.isFinite(parsedConstituency)) {
          return res.status(400).json({
            success: false,
            message: "Constituency ID must be a number"
          });
        }
        row[constituencyColumn] = parsedConstituency;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      setIfProvided(row, activeColumn, typeof isActive === "boolean" ? isActive : null);
    }

    const query = buildUpdate(table.name, row, table.columns, "Id", candidateId);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin update candidate error:", error);
    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid election or constituency. Select values that exist in master tables."
      });
    }
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

app.delete("/admin/candidates/:id", requireAdmin, async (req, res) => {
  const candidateId = req.params.id;
  try {
    const table = await resolveTableColumns(["Candidates", "candidates"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Candidates table not found" });
    }

    await pool.query(`DELETE FROM "${table.name}" WHERE "Id" = $1`, [candidateId]);
    return res.json({ success: true, message: "Candidate deleted" });
  } catch (error) {
    console.error("Admin delete candidate error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- ADMIN VOTERS ---------------- */
app.get("/admin/voters", requireAdmin, async (req, res) => {
  const search = sanitizeText(req.query.search);

  try {
    const table = await resolveTableColumns(["Voters", "voters"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Voters table not found" });
    }

    let queryText = `SELECT * FROM "${table.name}"`;
    const values = [];

    if (search) {
      const voterIdColumn = pickFirstExistingColumn(table.columns, ["Voter_UId", "voter_uid"]);
      const phoneColumn = pickFirstExistingColumn(table.columns, ["Phone_number", "phone_number"]);
      const whereParts = [];

      if (voterIdColumn) {
        values.push(`%${search}%`);
        whereParts.push(`"${voterIdColumn}" ILIKE $${values.length}`);
      }
      if (phoneColumn) {
        values.push(`%${search}%`);
        whereParts.push(`"${phoneColumn}" ILIKE $${values.length}`);
      }

      if (whereParts.length) {
        queryText += ` WHERE ${whereParts.join(" OR ")}`;
      }
    }

    queryText += ` ORDER BY "Id" DESC LIMIT 200`;

    const result = await pool.query(queryText, values);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Admin voters error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/voters", requireAdmin, async (req, res) => {
  const {
    voterId,
    voterName,
    phoneNumber,
    secretPin,
    fullName,
    email,
    gender,
    address,
    constituencyId,
    isActive,
    hasVoted,
    accountStatus
  } = req.body;

  try {
    const table = await resolveTableColumns(["Voters", "voters"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Voters table not found" });
    }

    const row = {};
    const voterIdColumn = pickFirstExistingColumn(table.columns, ["Voter_UId", "voter_uid"]);
    const voterNameColumn = pickFirstExistingColumn(table.columns, [
      "Voter_Name",
      "voter_name",
      "Full_Name",
      "full_name",
      "Name",
      "name"
    ]);
    const phoneColumn = pickFirstExistingColumn(table.columns, ["Phone_number", "phone_number"]);
    const pinColumn = pickFirstExistingColumn(table.columns, ["Secret_PIN", "secret_pin"]);
    const fullNameColumn = pickFirstExistingColumn(table.columns, ["Full_Name", "full_name"]);
    const emailColumn = pickFirstExistingColumn(table.columns, ["Email", "email"]);
    const genderColumn = pickFirstExistingColumn(table.columns, ["Gender", "gender"]);
    const addressColumn = pickFirstExistingColumn(table.columns, ["Address", "address"]);
    const constituencyColumn = pickFirstExistingColumn(table.columns, [
      "Constituency_Id",
      "constituency_id"
    ]);
    const activeColumn = pickFirstExistingColumn(table.columns, ["is_active", "Is_active"]);
    const votedColumn = pickFirstExistingColumn(table.columns, ["Has_voted", "has_voted"]);
    const accountStatusColumn = pickFirstExistingColumn(table.columns, [
      "account_status",
      "Account_status"
    ]);

    setIfProvided(row, voterIdColumn, sanitizeText(voterId) || undefined);
    setIfProvided(
      row,
      voterNameColumn,
      sanitizeText(voterName) || sanitizeText(fullName) || undefined
    );
    setIfProvided(row, phoneColumn, sanitizeText(phoneNumber) || undefined);
    setIfProvided(row, pinColumn, sanitizeText(secretPin) || undefined);
    setIfProvided(row, fullNameColumn, sanitizeText(fullName) || undefined);
    setIfProvided(row, emailColumn, sanitizeText(email) || undefined);
    setIfProvided(row, genderColumn, sanitizeText(gender) || undefined);
    setIfProvided(row, addressColumn, sanitizeText(address) || undefined);
    if (constituencyColumn) {
      const normalizedConstituencyId = sanitizeText(constituencyId);
      if (normalizedConstituencyId) {
        const parsedConstituencyId = Number(normalizedConstituencyId);
        if (!Number.isFinite(parsedConstituencyId)) {
          return res.status(400).json({
            success: false,
            message: "Constituency ID must be a number"
          });
        }
        row[constituencyColumn] = parsedConstituencyId;
      }
    }
    setIfProvided(row, activeColumn, typeof isActive === "boolean" ? isActive : true);
    setIfProvided(row, votedColumn, typeof hasVoted === "boolean" ? hasVoted : false);
    setIfProvided(row, accountStatusColumn, sanitizeText(accountStatus) || "active");

    const requiredInfo = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND is_nullable = 'NO'
         AND column_default IS NULL`,
      [table.name]
    );
    const missingColumns = requiredInfo.rows
      .map((r) => r.column_name)
      .filter((column) => row[column] === undefined || row[column] === null || row[column] === "");

    if (missingColumns.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingColumns.join(", ")}`
      });
    }

    const query = buildInsert(table.name, row, table.columns);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to insert" });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin create voter error:", error);
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

app.patch("/admin/voters/:id", requireAdmin, async (req, res) => {
  const voterId = req.params.id;
  const { isActive, hasVoted, accountStatus, phoneNumber } = req.body;

  try {
    const table = await resolveTableColumns(["Voters", "voters"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Voters table not found" });
    }

    const row = {
      is_active: typeof isActive === "boolean" ? isActive : undefined,
      Has_voted: typeof hasVoted === "boolean" ? hasVoted : undefined,
      account_status: sanitizeText(accountStatus) || undefined,
      Phone_number: sanitizeText(phoneNumber) || undefined
    };

    Object.keys(row).forEach((key) => {
      if (row[key] === undefined || row[key] === "") {
        delete row[key];
      }
    });

    const query = buildUpdate(table.name, row, table.columns, "Id", voterId);
    if (!query) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    query.text += " RETURNING *";
    const result = await pool.query(query.text, query.values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Admin update voter error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/admin/voters/:id", requireAdmin, async (req, res) => {
  const voterId = req.params.id;
  try {
    const table = await resolveTableColumns(["Voters", "voters"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Voters table not found" });
    }

    await pool.query(`DELETE FROM "${table.name}" WHERE "Id" = $1`, [voterId]);
    return res.json({ success: true, message: "Voter deleted" });
  } catch (error) {
    console.error("Admin delete voter error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/admin/voters", requireAdmin, async (req, res) => {
  const confirmed = sanitizeText(req.query.confirm).toLowerCase() === "true";
  if (!confirmed) {
    return res.status(400).json({
      success: false,
      message: "Pass confirm=true to delete all voters"
    });
  }

  try {
    const table = await resolveTableColumns(["Voters", "voters"]);
    
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Voters table not found" });
    }
    const votesTable = await resolveTableColumns(["votes", "Votes"]);

    await pool.query("BEGIN");
    if (votesTable.columns.length) {
      await pool.query(`DELETE FROM "${votesTable.name}"`);
    }
    const result = await pool.query(`DELETE FROM "${table.name}"`);
    await pool.query("COMMIT");

    return res.json({
      success: true,
      message: "All voters deleted",
      deleted: result.rowCount || 0
    });
  } catch (error) {
    try {
      await pool.query("ROLLBACK");
    } catch (rollbackError) {
      // ignore rollback errors
    }
    console.error("Admin delete all voters error:", error);
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});

app.post("/admin/voters/upload", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "File is required" });
  }

  try {
    const table = await resolveTableColumns(["Voters", "voters"]);
    if (!table.columns.length) {
      return res.status(500).json({ success: false, message: "Voters table not found" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

    const headerMap = {
      voterid: "Voter_UId",
      voteruid: "Voter_UId",
      votersuid: "Voter_UId",
      voteruidnumber: "Voter_UId",
      votername: "Voter_Name",
      phonenumber: "Phone_number",
      phone: "Phone_number",
      mobilenumber: "Phone_number",
      secretpin: "Secret_PIN",
      pin: "Secret_PIN",
      secret_pin: "Secret_PIN",
      constituencyid: "Constituency_Id",
      constituency: "Constituency_Id",
      isactive: "is_active",
      active: "is_active",
      hasvoted: "Has_voted",
      accountstatus: "account_status",
      locktime: "lock_time",
      fullname: "Full_Name",
      name: "Full_Name",
      email: "Email",
      gender: "Gender",
      address: "Address"
    };

    const parseBoolean = (value) => {
      const normalized = sanitizeText(value).toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
      return undefined;
    };

    const requiredInfo = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND is_nullable = 'NO'
         AND column_default IS NULL`,
      [table.name]
    );
    const requiredColumns = requiredInfo.rows.map((r) => r.column_name);

    let inserted = 0;
    let failed = 0;
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const record = {};
      const normalizedRow = {};
      Object.keys(row).forEach((key) => {
        const normalized = normalizeHeader(key);
        normalizedRow[normalized] = sanitizeText(row[key]);
        const column = headerMap[normalized];
        if (column) {
          record[column] = sanitizeText(row[key]);
        }
      });

      if (!record.Voter_UId) {
        const fallbackVoterIdEntry = Object.entries(normalizedRow).find(
          ([key, value]) =>
            value &&
            key.includes("voter") &&
            (key.includes("uid") || key.endsWith("id"))
        );
        if (fallbackVoterIdEntry) {
          record.Voter_UId = fallbackVoterIdEntry[1];
        }
      }

      if (table.columns.includes("Voter_Name") && !record.Voter_Name && record.Full_Name) {
        record.Voter_Name = record.Full_Name;
      }
      if (table.columns.includes("Full_Name") && !record.Full_Name && record.Voter_Name) {
        record.Full_Name = record.Voter_Name;
      }

      if (table.columns.includes("Constituency_Id") && record.Constituency_Id !== undefined) {
        const parsedConstituencyId = Number(record.Constituency_Id);
        if (Number.isFinite(parsedConstituencyId)) {
          record.Constituency_Id = parsedConstituencyId;
        } else {
          delete record.Constituency_Id;
        }
      }
      if (table.columns.includes("is_active")) {
        const parsedIsActive = parseBoolean(record.is_active);
        record.is_active = parsedIsActive !== undefined ? parsedIsActive : true;
      }
      if (table.columns.includes("Has_voted")) {
        const parsedHasVoted = parseBoolean(record.Has_voted);
        record.Has_voted = parsedHasVoted !== undefined ? parsedHasVoted : false;
      }

      if (table.columns.includes("account_status") && !record.account_status) {
        record.account_status = "active";
      }

      const missingColumns = requiredColumns.filter(
        (column) => record[column] === undefined || record[column] === null || record[column] === ""
      );
      if (missingColumns.length) {
        failed += 1;
        errors.push({
          row: index + 2,
          reason: `Missing required columns: ${missingColumns.join(", ")}`
        });
        continue;
      }

      const query = buildInsert(table.name, record, table.columns);
      if (!query) {
        failed += 1;
        errors.push({ row: index + 2, reason: "No valid columns" });
        continue;
      }

      try {
        await pool.query(query.text, query.values);
        inserted += 1;
      } catch (error) {
        failed += 1;
        if (error.code === "23503" && error.constraint === "fk_voters_constituency") {
          errors.push({
            row: index + 2,
            reason: `Invalid Constituency_Id ${record.Constituency_Id}. Add it in constituencies table first.`
          });
          continue;
        }
        errors.push({ row: index + 2, reason: error.message });
      }
    }

    return res.json({
      success: true,
      inserted,
      failed,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error("Admin upload voters error:", error);
    return res.status(500).json({
      success: false,
      message: error.detail || error.message || "Server error"
    });
  }
});


// 🔧 TEMP ADMIN API: FULL RESET FOR TESTING
app.post("/admin/reset-votes", requireAdmin, async (req, res) => {
  try {
    // 1️⃣ Clear votes (for all elections – testing only)
    await pool.query(`DELETE FROM votes`);

    // 2️⃣ Reset voter status
    await pool.query(`UPDATE "Voters" SET "Has_voted" = false`);

    res.json({
      success: true,
      message: "Votes table cleared and voters reset successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* ---------------- SERVER ---------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
