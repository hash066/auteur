const googleLogin = document.querySelector("#google-login");
const loginResult = document.querySelector("#login-result");

await checkIfAlreadySignedIn();
showAuthMessage();

googleLogin.addEventListener("click", () => {
  loginResult.className = "login-result";
  loginResult.textContent = "Redirecting to Google...";
  window.location.href = "/api/v1/auth/google/start";
});

async function checkIfAlreadySignedIn() {
  try {
    const response = await fetch("/api/v1/auth/session");
    const json = await response.json();
    if (json.signedIn) {
      window.location.href = "/dashboard.html";
      return;
    }
    if (!json.configured) {
      loginResult.className = "login-result waitlisted";
      loginResult.textContent = "Google auth not configured on server yet.";
    }
  } catch {
    loginResult.className = "login-result waitlisted";
    loginResult.textContent = "Could not connect to auth service.";
  }
}

function showAuthMessage() {
  const status = new URLSearchParams(window.location.search).get("auth");
  if (!status) return;
  loginResult.className = "login-result waitlisted";
  if (status === "config") {
    loginResult.textContent = "Google auth is not configured on server.";
    return;
  }
  if (status === "state") {
    loginResult.textContent = "Sign-in security check failed. Please try again.";
    return;
  }
  if (status === "email") {
    loginResult.textContent = "Google account email was missing.";
    return;
  }
  loginResult.textContent = "Google sign-in failed. Please try again.";
}
