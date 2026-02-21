async function main() {
  const VoteLedger = await ethers.getContractFactory("VoteLedger");
  const voteLedger = await VoteLedger.deploy();

  // ethers v6 deployment wait
  await voteLedger.waitForDeployment();

  const address = await voteLedger.getAddress();
  console.log("✅ VoteLedger deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
