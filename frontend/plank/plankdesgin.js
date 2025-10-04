// frontend/plank/plankdesign.js
// Building a small HUD panel (status, score, timer, tips) under the webcam

export function initPlankUI(containerId = "plank-webcam") {
  // Locating the webcam container
  const container = document.getElementById(containerId);
  if (!container) throw new Error("initPlankUI: container not found: " + containerId);

  // Creating the HUD wrapper
  const hud = document.createElement("div");
  hud.style.marginTop = "12px";
  hud.style.display = "grid";
  hud.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  hud.style.gap = "8px";
  hud.style.alignItems = "center";

  // Creating individual info cards
  const statusCard = createCard("Status", "Waiting for webcam…");
  const scoreCard  = createCard("Form Score", "0");
  const timerCard  = createCard("Hold Time", "0.0s");

  // Creating tips area (spanning full width)
  const tipsCard = createCard("Tip", "Click ENABLE WEBCAM to begin");
  tipsCard.style.gridColumn = "1 / -1";

  // Appending to DOM
  hud.append(statusCard.wrapper, scoreCard.wrapper, timerCard.wrapper, tipsCard.wrapper);
  container.appendChild(hud);

  // Returning UI setter API
  return {
    setStatus(text) { statusCard.value.textContent = text; },
    setScore(n)    { scoreCard.value.textContent = String(Math.round(n)); },
    setTimer(s)    { timerCard.value.textContent = `${s.toFixed(1)}s`; },
    setTip(text)   { tipsCard.value.textContent = text; },
  };
}

// Creating a small labeled card
function createCard(labelText, initialValue) {
  // Creating wrapper
  const wrapper = document.createElement("div");
  wrapper.style.border = "1px solid #ccc";
  wrapper.style.borderRadius = "12px";
  wrapper.style.padding = "10px 12px";
  wrapper.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
  wrapper.style.background = "white";

  // Creating label
  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.fontSize = "12px";
  label.style.color = "#666";
  label.style.marginBottom = "4px";

  // Creating value
  const value = document.createElement("div");
  value.textContent = initialValue;
  value.style.fontSize = "18px";
  value.style.fontWeight = "600";

  // Appending
  wrapper.appendChild(label);
  wrapper.appendChild(value);

  return { wrapper, value };
}
