
const cfg = window.FRESHTRACK_CONFIG || {};
const configReady =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR_") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

let db = null;
let items = [];
let completedItems = [];
let completedCount = 0;
let pendingCompleteId = null;
let pendingHistoryDeleteId = null;
let authMode = "login";
let realtimeChannel = null;

const $ = (id) => document.getElementById(id);

if (configReady) {
  db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
} else {
  $("setupWarning").classList.remove("hidden");
  $("authSubmit").disabled = true;
}

function setSyncStatus(text, mode = "online") {
  const el = $("syncStatus");
  el.textContent = text;
  el.className = `sync-pill ${mode === "online" ? "" : mode}`.trim();
}

function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("signupTab").classList.toggle("active", mode === "signup");
  $("authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authMessage").textContent = "";
}

$("loginTab").addEventListener("click", () => setAuthMode("login"));
$("signupTab").addEventListener("click", () => setAuthMode("signup"));

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "";

  try {
    if (authMode === "signup") {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;

      if (data.session) {
        $("authMessage").textContent = "Account created. Signing you in…";
      } else {
        $("authMessage").style.color = "#087a45";
        $("authMessage").textContent = "Account created. Check your email to confirm it, then sign in.";
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    $("authMessage").style.color = "";
    $("authMessage").textContent = err.message || "Authentication failed.";
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("signOutBtn").addEventListener("click", async () => {
  if (!db) return;
  await db.auth.signOut();
});

async function showApp(session) {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userEmail").textContent = session.user.email || "Signed in";
  setSyncStatus("Syncing…", "offline");
  await loadItems();
  subscribeToChanges();
}

function showAuth() {
  $("appView").classList.add("hidden");
  $("authView").classList.remove("hidden");
  if (realtimeChannel && db) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

async function loadItems() {
  if (!db) return;
  setSyncStatus("Syncing…", "offline");

  const { data, error } = await db
    .from("inventory_items")
    .select("*")
    .order("expires_at", { ascending: true });

  if (error) {
    setSyncStatus("Sync error", "error");
    $("loadingState").textContent = `Could not load inventory: ${error.message}`;
    return;
  }

  items = (data || []).filter(x => !x.completed);
  completedItems = (data || []).filter(x => x.completed);
  completedCount = completedItems.length;

  $("loadingState").classList.add("hidden");
  $("tableWrap").classList.remove("hidden");
  setSyncStatus("Live", "online");
  render();
}

function subscribeToChanges() {
  if (!db || realtimeChannel) return;

  realtimeChannel = db
    .channel("freshtrack-inventory")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory_items" },
      async () => {
        await loadItems();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setSyncStatus("Live", "online");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSyncStatus("Reconnect needed", "error");
      else setSyncStatus("Connecting…", "offline");
    });
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
  const diff = new Date(item.expires_at).getTime() - Date.now();
  if (diff <= 0) return "expired";
  if (diff <= 24 * 60 * 60 * 1000) return "soon";
  return "good";
}

function formatTimeLeft(item) {
  let diff = new Date(item.expires_at).getTime() - Date.now();
  if (diff <= 0) {
    diff = Math.abs(diff);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours >= 24) return `Expired ${Math.floor(hours/24)}d ago`;
    return `Expired ${hours}h ${mins}m ago`;
  }

  const totalMinutes = Math.max(0, Math.floor(diff / 60000));
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
    .sort((a,b) => new Date(a.expires_at) - new Date(b.expires_at));

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
          <strong>${escapeHtml(item.product_name)}</strong>
          <span>${escapeHtml(item.location)} · Expires ${formatDateTime(item.expires_at)}</span>
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
      item.product_name.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.staff_initials.toLowerCase().includes(query);
    const matchesStatus = filter === "all" || getStatus(item) === filter;
    return matchesQuery && matchesStatus;
  });

  if (sort === "expiry") result.sort((a,b) => new Date(a.expires_at) - new Date(b.expires_at));
  else if (sort === "newest") result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === "name") result.sort((a,b) => a.product_name.localeCompare(b.product_name));

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
        <td><span class="item-name">${escapeHtml(item.product_name)}</span></td>
        <td>${escapeHtml(item.location)}</td>
        <td>${formatDateTime(item.prepared_at)}</td>
        <td>${formatDateTime(item.expires_at)}</td>
        <td class="time-left">${formatTimeLeft(item)}</td>
        <td><span class="badge badge-${status}">${statusLabel(status)}</span></td>
        <td>${escapeHtml(item.staff_initials)}</td>
        <td><button class="action-btn" data-complete="${item.id}">Complete</button></td>
      </tr>
    `;
  }).join("");

  empty.classList.toggle("hidden", list.length !== 0);

  document.querySelectorAll("[data-complete]").forEach(button => {
    button.addEventListener("click", () => {
      pendingCompleteId = button.dataset.complete;
      $("confirmDialog").showModal();
    });
  });
}

function filteredCompletedItems() {
  const query = $("historySearchInput").value.trim().toLowerCase();
  const sort = $("historySortSelect").value;

  let result = completedItems.filter(item =>
    item.product_name.toLowerCase().includes(query) ||
    item.location.toLowerCase().includes(query) ||
    item.staff_initials.toLowerCase().includes(query)
  );

  if (sort === "completed-newest") {
    result.sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));
  } else if (sort === "completed-oldest") {
    result.sort((a, b) => new Date(a.completed_at || a.created_at) - new Date(b.completed_at || b.created_at));
  } else if (sort === "name") {
    result.sort((a, b) => a.product_name.localeCompare(b.product_name));
  }

  return result;
}

function renderCompletedHistory() {
  const list = filteredCompletedItems();
  const body = $("historyBody");
  const empty = $("historyEmpty");
  const wrap = $("historyTableWrap");

  if (!list.length) {
    body.innerHTML = "";
    empty.classList.remove("hidden");
    wrap.classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  wrap.classList.remove("hidden");

  body.innerHTML = list.map(item => `
    <tr>
      <td><span class="item-name">${escapeHtml(item.product_name)}</span></td>
      <td>${escapeHtml(item.location)}</td>
      <td>${formatDateTime(item.prepared_at)}</td>
      <td>${formatDateTime(item.expires_at)}</td>
      <td>${item.completed_at ? formatDateTime(item.completed_at) : "—"}</td>
      <td>${escapeHtml(item.staff_initials)}</td>
      <td><button class="history-delete-btn" data-history-delete="${item.id}">Delete</button></td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-history-delete]").forEach(button => {
    button.addEventListener("click", () => {
      pendingHistoryDeleteId = button.dataset.historyDelete;
      $("deleteHistoryDialog").showModal();
    });
  });
}

function openCompletedHistory() {
  renderCompletedHistory();
  $("historyDialog").showModal();
}

function render() {
  renderStats();
  renderAttention();
  renderInventory();
  renderCompletedHistory();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function openAddDialog() {
  const now = new Date();
  $("preparedAt").value = toLocalInputValue(now);
  $("expiresAt").value = toLocalInputValue(new Date(now.getTime() + 48 * 3600000));
  $("formError").textContent = "";
  $("itemDialog").showModal();
  setTimeout(() => $("productName").focus(), 50);
}

$("addItemTopBtn").addEventListener("click", openAddDialog);
$("closeDialogBtn").addEventListener("click", () => $("itemDialog").close());
$("cancelBtn").addEventListener("click", () => $("itemDialog").close());

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

$("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;

  const preparedAt = $("preparedAt").value;
  const expiresAt = $("expiresAt").value;
  const submit = $("addItemSubmit");
  $("formError").textContent = "";

  if (new Date(expiresAt) <= new Date(preparedAt)) {
    $("formError").textContent = "Expiration time must be after the prepared/opened time.";
    return;
  }

  submit.disabled = true;

  const { error } = await db.from("inventory_items").insert({
    product_name: $("productName").value.trim(),
    location: $("location").value.trim(),
    prepared_at: new Date(preparedAt).toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
    staff_initials: $("staffInitials").value.trim().toUpperCase()
  });

  submit.disabled = false;

  if (error) {
    $("formError").textContent = error.message;
    return;
  }

  $("itemForm").reset();
  $("itemDialog").close();
  await loadItems();
});

$("confirmCancel").addEventListener("click", () => {
  pendingCompleteId = null;
  $("confirmDialog").close();
});

$("confirmComplete").addEventListener("click", async () => {
  if (!pendingCompleteId || !db) return;

  const button = $("confirmComplete");
  button.disabled = true;

  const { data: { user } } = await db.auth.getUser();
  const { error } = await db
    .from("inventory_items")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      completed_by: user?.id || null
    })
    .eq("id", pendingCompleteId);

  button.disabled = false;

  if (error) {
    alert(`Could not complete item: ${error.message}`);
    return;
  }

  pendingCompleteId = null;
  $("confirmDialog").close();
  await loadItems();
});



$("deleteHistoryCancel").addEventListener("click", () => {
  pendingHistoryDeleteId = null;
  $("deleteHistoryDialog").close();
});

$("deleteHistoryConfirm").addEventListener("click", async () => {
  if (!pendingHistoryDeleteId || !db) return;

  const button = $("deleteHistoryConfirm");
  button.disabled = true;

  const { error } = await db
    .from("inventory_items")
    .delete()
    .eq("id", pendingHistoryDeleteId)
    .eq("completed", true);

  button.disabled = false;

  if (error) {
    alert(`Could not delete completed item: ${error.message}`);
    return;
  }

  pendingHistoryDeleteId = null;
  $("deleteHistoryDialog").close();
  await loadItems();
});

$("completedCard").addEventListener("click", openCompletedHistory);
$("completedCard").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openCompletedHistory();
  }
});
$("closeHistoryBtn").addEventListener("click", () => $("historyDialog").close());
$("historySearchInput").addEventListener("input", renderCompletedHistory);
$("historySortSelect").addEventListener("change", renderCompletedHistory);

["searchInput", "statusFilter", "sortSelect"].forEach(id => {
  $(id).addEventListener(id === "searchInput" ? "input" : "change", renderInventory);
});

updateClock();
setInterval(updateClock, 1000);
setInterval(render, 60000);

async function boot() {
  if (!db) return;

  const { data: { session } } = await db.auth.getSession();
  if (session) await showApp(session);
  else showAuth();

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session) await showApp(session);
    else showAuth();
  });
}

boot();
