const form = document.querySelector("#job-form");
const output = document.querySelector("#output");
const jobId = document.querySelector("#job-id");
const storyboards = document.querySelector("#storyboards");
const tiers = document.querySelector("#tiers");
const createKey = document.querySelector("#create-key");
const generatedKey = document.querySelector("#generated-key");
const mcpConfig = document.querySelector("#mcp-config");
const googleLogin = document.querySelector("#google-login");
const loginResult = document.querySelector("#login-result");

let count = 0;

loadTiers();

googleLogin.addEventListener("click", async () => {
  loginResult.className = "login-result";
  loginResult.textContent = "Checking access...";

  try {
    const response = await fetch("/api/v1/auth/google-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.querySelector("#login-email").value.trim(),
        name: document.querySelector("#login-name").value.trim()
      })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "login failed");
    loginResult.classList.add(json.status);
    loginResult.textContent =
      json.status === "waitlisted"
        ? `Waitlist #${json.waitlistNumber}. ${json.message}`
        : `Access granted. ${json.message}`;
  } catch (error) {
    loginResult.textContent = `Could not sign in: ${error.message}`;
  }
});

createKey.addEventListener("click", async () => {
  generatedKey.value = "Creating...";
  mcpConfig.value = "";

  const adminKey = document.querySelector("#api-key").value.trim();
  const headers = { "Content-Type": "application/json" };
  if (adminKey) headers.Authorization = `Bearer ${adminKey}`;

  try {
    const response = await fetch("/api/v1/api-keys", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: document.querySelector("#key-name").value.trim(),
        tier: document.querySelector("#key-tier").value
      })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "key creation failed");
    generatedKey.value = json.key;
    document.querySelector("#api-key").value = json.key;
    mcpConfig.value = JSON.stringify(json.mcpConfig, null, 2);
  } catch (error) {
    generatedKey.value = "";
    mcpConfig.value = `Could not create key: ${error.message}`;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.textContent = "Generating storyboard...";

  const captures = document
    .querySelector("#captures")
    .value.split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = {
    productName: document.querySelector("#product").value.trim(),
    repoPath: document.querySelector("#repo-path").value.trim(),
    durationSeconds: Number(document.querySelector("#duration").value),
    vibe: document.querySelector("#vibe").value.trim(),
    referenceStyle: "Cursorful-like focal zooms with side callouts",
    captures,
    render: false
  };

  const key = document.querySelector("#api-key").value.trim();
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const response = await fetch("/api/v1/generate-launch-film", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "request failed");
    count += 1;
    storyboards.textContent = String(count);
    jobId.textContent = json.jobId;
    output.textContent = JSON.stringify(json.storyboard, null, 2);
  } catch (error) {
    output.textContent = `No storyboard yet.\n\n${error.message}`;
  }
});

async function loadTiers() {
  const response = await fetch("/api/v1/tiers");
  const json = await response.json();
  tiers.innerHTML = json.tiers
    .map(
      (tier) => `
        <div class="tier">
          <strong>${tier.name}</strong>
          <span>${tier.monthlyUsd ? `$${tier.monthlyUsd}/mo` : tier.id === "enterprise" ? "custom" : "free"}</span>
          <small>${tier.includedRenders < 0 ? "unlimited" : tier.includedRenders} renders</small>
        </div>
      `
    )
    .join("");
}
