<<<<<<< HEAD
# CivicShield – Blockchain-Based E-Voting System

## Overview
CivicShield is a full-stack digital voting platform designed to ensure transparency and tamper-resistant vote storage using blockchain.

## Tech Stack
Frontend: React  
Backend: Node.js, Express  
Database: PostgreSQL  
Blockchain: Ethereum (Ganache)

## Features
- Role-based login
- Secure vote casting
- Blockchain vote storage
- Admin dashboard
- REST API backend

## Planned Enhancements
- OTP phone verification
- Registration module
- UI improvements
- Deployment

## Author
Dhanunjaya Rao
=======
# CivicShield Project

CivicShield is a full-stack e-voting prototype with three modules:
- `Frontend/frontend`: React voter and admin UI
- `Backend`: Express API with PostgreSQL + blockchain integration
- `Blockchain`: Hardhat smart contract workspace (`VoteLedger.sol`)

## Repository Structure

```text
CivicShield Project/
  Backend/
    abi/
    index.js
    db.js
    deploy.js
    package.json
  Blockchain/
    contracts/
      VoteLedger.sol
    scripts/
      deploy.js
    hardhat.config.js
    package.json
  Frontend/
    frontend/
      src/
      public/
      package.json
```

Notes:
- `node_modules`, `build`, `artifacts`, and `cache` are present as generated/runtime folders.
- Existing module READMEs are boilerplate; this root README reflects current project code.

## Tech Stack

- Frontend: React (CRA), Bootstrap
- Backend: Node.js, Express, `pg`, `ethers`, `multer`, `xlsx`
- Database: PostgreSQL
- Blockchain: Solidity + Hardhat + Ganache (local JSON-RPC)

## Core Features

- Voter login with Voter ID + phone
- OTP generation/verification (demo mode, local memory store)
- PIN verification before voting
- Vote cast flow writes receipt hash on-chain and records DB vote
- Result dashboard + downloadable PDF receipt + QR generation
- Vote verification by transaction hash
- Admin login and dashboard
- Admin CRUD for elections, constituencies, candidates, voters
- Admin bulk voter upload from Excel (`.xlsx`/`.xls`)

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL running locally
- Ganache running at `http://127.0.0.1:7545`

## Local Configuration

Current code uses hardcoded local values:

- Backend DB config in `Backend/db.js`
  - host: `localhost`
  - user: `postgres`
  - password: `postgres`
  - database: `civic_shield`
  - port: `5432`

- Backend blockchain config in `Backend/index.js`
  - RPC URL: `http://127.0.0.1:7545`
  - hardcoded private key
  - hardcoded contract address: `0x775AAc494801842EA6e8259C1cC23346F794da79`

- Hardhat config in `Blockchain/hardhat.config.js`
  - Ganache network URL + private key configured directly in file

## Install Dependencies

```bash
cd Backend && npm install
cd ../Blockchain && npm install
cd ../Frontend/frontend && npm install
```

## Run the Project

Run each module in a separate terminal.

1) Start Ganache
- Ensure local chain is running on `7545`.

2) (Optional but recommended) Deploy contract from `Blockchain`
```bash
cd Blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```
- After deploy, copy deployed address and update `contractAddress` in `Backend/index.js`.
- Ensure backend ABI matches deployed contract (`Backend/abi/VoteLedger.json`).

3) Start backend
```bash
cd Backend
node index.js
```
Backend runs on `http://localhost:5000`.

4) Start frontend
```bash
cd Frontend/frontend
npm start
```
Frontend runs on `http://localhost:3000`.

## Key API Endpoints (Backend)

Public/user flow:
- `POST /login`
- `POST /verify-otp`
- `POST /resend-otp`
- `POST /verify-pin`
- `GET /candidates/:ElectionId`
- `POST /vote`
- `GET /results/:ElectionId`
- `POST /verify-vote`

Admin flow (Bearer token required after login):
- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/profile`
- `GET/POST /admin/elections`
- `GET/PATCH/DELETE /admin/elections/:id`
- `GET/POST /admin/constituencies`
- `GET/POST /admin/candidates`
- `PATCH/DELETE /admin/candidates/:id`
- `GET/POST /admin/voters`
- `PATCH/DELETE /admin/voters/:id`
- `DELETE /admin/voters?confirm=true`
- `POST /admin/voters/upload`
- `POST /admin/reset-votes`

## Verification Findings

During repository verification, these are important:

1. Frontend expects `GET /elections` in `Frontend/frontend/src/pages/Vote.jsx`, but backend currently exposes only admin elections endpoints (`/admin/elections`).
2. Sensitive values are hardcoded (DB credentials, private keys, contract address).
3. Backend and blockchain package scripts are minimal; start/deploy commands are manual.

## Suggested Next Improvements

1. Add a public `GET /elections` backend endpoint used by voter flow.
2. Move secrets/config to environment variables (`.env`) and remove hardcoded keys.
3. Add proper npm scripts (`start`, `dev`, `deploy`, `test`) per module.
4. Add SQL schema/migrations for reproducible setup.
5. Add integration tests for vote flow and admin APIs.

## Important Security Note

This repository currently contains hardcoded private keys and credentials suitable only for local development/testing. Do not deploy this code as-is to production.
>>>>>>> f1089a3 (Initial commit: CivicShield full-stack voting system)
