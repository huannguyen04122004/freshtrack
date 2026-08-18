
const STORAGE_KEY = "freshtrack-items-v1";
const COMPLETED_KEY = "freshtrack-completed-v1";

let items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let completedCount = Number(localStorage.getItem(COMPLETED_KEY) || 0);
let pendingCompleteId = null;

const $ = (id) => document.getElementById(id);

const itemDialog = $("itemDialog");
const confirmDialog = $("confirmDialog");
const itemForm = $("itemForm");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(COMPLETED_KEY, completedCount);
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}

function getStatus(item) {
  const diff = new Date(item.expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  if (diff <= 24 * 60 * 60 * 1000) return "soon";
  return "good";
}

function formatTimeLeft(item) {
  let diff = new Date(item.expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    diff = Math.abs(diff);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours >= 24) return `Expired ${Math.floor(hours/24)}d ago`;
    return `Expired ${hours}h ${mins}m ago`;
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function statusLabel(status) {
  if (status === "expired") return "Expired";
  if (status === "soon") return "Expiring soon";
  return "Good";
}

function updateClock() {
  const now = new Date();
  $("currentDate").textContent = now.toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric"
  });
  $("currentTime").textContent = now.toLocaleTimeString([], {
    hour: "numeric", minute: "2-digit", second: "2-digit"
  });
}

function renderStats() {
  const statuses = items.map(getStatus);
  $("activeCount").textContent = items.length;
  $("soonCount").textContent = statuses.filter(s => s === "soon").length;
  $("expiredCount").textContent = statuses.filter(s => s === "expired").length;
  $("completedCount").textContent = completedCount;
}

function renderAttention() {
  const attention = items
    .filter(item => ["expired", "soon"].includes(getStatus(item)))
    .sort((a,b) => new Date(a.expiresAt) - new Date(b.expiresAt));

  const container = $("attentionList");

  if (!attention.length) {
    container.innerHTML = `<div class="empty-state">Nothing needs attention right now.</div>`;
    return;
  }

  container.innerHTML = attention.map(item => {
    const status = getStatus(item);
    return `
      <div class="attention-item">
        <div class="attention-main">
          <strong>${escapeHtml(item.productName)}</strong>
          <span>${escapeHtml(item.location)} · Expires ${formatDateTime(item.expiresAt)}</span>
        </div>
        <div class="attention-time">
          <span class="badge badge-${status}">${statusLabel(status)}</span>
          <div style="margin-top:6px">${formatTimeLeft(item)}</div>
        </div>
      </div>
    `;
  }).join("");
}

function filteredItems() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filter = $("statusFilter").value;
  const sort = $("sortSelect").value;

  let result = items.filter(item => {
    const matchesQuery =
      item.productName.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.staffInitials.toLowerCase().includes(query);
    const matchesStatus = filter === "all" || getStatus(item) === filter;
    return matchesQuery && matchesStatus;
  });

  if (sort === "expiry") {
    result.sort((a,b) => new Date(a.expiresAt) - new Date(b.expiresAt));
  } else if (sort === "newest") {
    result.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === "name") {
    result.sort((a,b) => a.productName.localeCompare(b.productName));
  }

  return result;
}

function renderInventory() {
  const list = filteredItems();
  const body = $("inventoryBody");
  const empty = $("inventoryEmpty");

  body.innerHTML = list.map(item => {
    const status = getStatus(item);
    return `
      <tr>
        <td><span class="item-name">${escapeHtml(item.productName)}</span></td>
        <td>${escapeHtml(item.location)}</td>
        <td>${formatDateTime(item.preparedAt)}</td>
        <td>${formatDateTime(item.expiresAt)}</td>
        <td class="time-left">${formatTimeLeft(item)}</td>
        <td><span class="badge badge-${status}">${statusLabel(status)}</span></td>
        <td>${escapeHtml(item.staffInitials)}</td>
        <td><button class="action-btn" data-complete="${item.id}">Complete</button></td>
      </tr>
    `;
  }).join("");

  empty.classList.toggle("hidden", list.length !== 0);

  document.querySelectorAll("[data-complete]").forEach(button => {
    button.addEventListener("click", () => {
      pendingCompleteId = button.dataset.complete;
      confirmDialog.showModal();
    });
  });
}

function render() {
  renderStats();
  renderAttention();
  renderInventory();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function openAddDialog() {
  const now = new Date();
  $("preparedAt").value = toLocalInputValue(now);
  $("expiresAt").value = toLocalInputValue(new Date(now.getTime() + 48 * 3600000));
  itemDialog.showModal();
  setTimeout(() => $("productName").focus(), 50);
}

$("addItemTopBtn").addEventListener("click", openAddDialog);
$("closeDialogBtn").addEventListener("click", () => itemDialog.close());
$("cancelBtn").addEventListener("click", () => itemDialog.close());

$("shelfLifePreset").addEventListener("change", (e) => {
  const hours = Number(e.target.value);
  if (!hours) return;
  const prepared = new Date($("preparedAt").value);
  if (Number.isNaN(prepared.getTime())) return;
  $("expiresAt").value = toLocalInputValue(new Date(prepared.getTime() + hours * 3600000));
});

$("preparedAt").addEventListener("change", () => {
  const hours = Number($("shelfLifePreset").value);
  if (!hours) return;
  const prepared = new Date($("preparedAt").value);
  if (Number.isNaN(prepared.getTime())) return;
  $("expiresAt").value = toLocalInputValue(new Date(prepared.getTime() + hours * 3600000));
});

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const preparedAt = $("preparedAt").value;
  const expiresAt = $("expiresAt").value;

  if (new Date(expiresAt) <= new Date(preparedAt)) {
    alert("Expiration time must be after the prepared/opened time.");
    return;
  }

  items.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    productName: $("productName").value.trim(),
    location: $("location").value.trim(),
    preparedAt,
    expiresAt,
    staffInitials: $("staffInitials").value.trim().toUpperCase(),
    createdAt: new Date().toISOString()
  });

  save();
  itemForm.reset();
  itemDialog.close();
  render();
});

$("confirmCancel").addEventListener("click", () => {
  pendingCompleteId = null;
  confirmDialog.close();
});

$("confirmComplete").addEventListener("click", () => {
  if (pendingCompleteId) {
    items = items.filter(item => item.id !== pendingCompleteId);
    completedCount += 1;
    save();
    pendingCompleteId = null;
    confirmDialog.close();
    render();
  }
});

["searchInput", "statusFilter", "sortSelect"].forEach(id => {
  $(id).addEventListener(id === "searchInput" ? "input" : "change", renderInventory);
});

updateClock();
setInterval(updateClock, 1000);
setInterval(render, 60000);
render();
