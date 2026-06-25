const API_BASE = "http://localhost:4000";
const DASHBOARD_URL = "http://localhost:5173";

const form = document.querySelector("#search-form");
const productInput = document.querySelector("#product");
const locationInput = document.querySelector("#location");
const submitButton = document.querySelector("#submit");
const openButton = document.querySelector("#open-dashboard");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");
const progressBar = document.querySelector("#progress-bar");
const message = document.querySelector("#message");

let activeSearchId = "";
let pollTimer = null;

function setStatus(status, progress = 0) {
  statusText.textContent = status || "Idle";
  progressBar.style.width = `${progress || 0}%`;
  statusDot.className = "dot";

  if (status === "completed") statusDot.classList.add("done");
  else if (status === "failed") statusDot.classList.add("failed");
  else if (status && status !== "idle") statusDot.classList.add("active");
  else statusDot.classList.add("idle");
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed with ${response.status}`);
  return payload;
}

function dashboardUrl(searchId) {
  return `${DASHBOARD_URL}?searchId=${encodeURIComponent(searchId)}`;
}

async function poll(searchId) {
  const payload = await request(`/api/results/${searchId}`);
  const search = payload.search;
  setStatus(search.status, search.progress);
  message.textContent = `${payload.products.length} products from ${payload.websites.length} websites`;

  if (search.status === "completed" || search.status === "failed") {
    window.clearInterval(pollTimer);
    pollTimer = null;
    submitButton.disabled = false;
    openButton.disabled = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  openButton.disabled = true;
  message.textContent = "";
  setStatus("searching", 8);

  try {
    const payload = await request("/api/search", {
      method: "POST",
      body: JSON.stringify({
        productName: productInput.value.trim(),
        location: locationInput.value.trim()
      })
    });

    activeSearchId = payload.searchId;
    await chrome.storage.local.set({
      easyShopLastSearchId: activeSearchId,
      easyShopProduct: productInput.value.trim(),
      easyShopLocation: locationInput.value.trim()
    });

    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => poll(activeSearchId).catch((error) => {
      message.textContent = error.message;
      setStatus("failed", 100);
      submitButton.disabled = false;
    }), 2200);
    await poll(activeSearchId);
  } catch (error) {
    message.textContent = error.message;
    setStatus("failed", 100);
    submitButton.disabled = false;
  }
});

openButton.addEventListener("click", async () => {
  if (!activeSearchId) return;
  await chrome.runtime.sendMessage({
    type: "OPEN_DASHBOARD",
    url: dashboardUrl(activeSearchId)
  });
});

chrome.storage.local.get(["easyShopLastSearchId", "easyShopProduct", "easyShopLocation"], (stored) => {
  if (stored.easyShopProduct) productInput.value = stored.easyShopProduct;
  if (stored.easyShopLocation) locationInput.value = stored.easyShopLocation;
  if (stored.easyShopLastSearchId) {
    activeSearchId = stored.easyShopLastSearchId;
    openButton.disabled = false;
  }
});
