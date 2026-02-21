const { ethers } = require("ethers");
const fs = require("fs");

// 1️⃣ Provider (Ganache)
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");

// 2️⃣ Ganache Account Private Key (Account 1)
const PRIVATE_KEY = "PASTE_GANACHE_PRIVATE_KEY_HERE";

// 3️⃣ Wallet
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// 4️⃣ Load ABI & Bytecode
const artifact = JSON.parse(
  fs.readFileSync("./abi/VoteLedger.json", "utf8")
);

async function deploy() {
  console.log("🚀 Deploying contract...");

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log("✅ Contract deployed at:");
  console.log(contract.target);
}

deploy().catch(console.error);
