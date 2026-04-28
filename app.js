const state = {
  mode: "learn",
  operations: [],
  ledger: [],
};

const accountNature = {
  Caja: "activo",
  Banco: "activo",
  Clientes: "activo",
  "Equipo de cómputo": "activo",
  Proveedores: "pasivo",
  Capital: "patrimonio",
  "Ingresos por servicios": "ingreso",
  "Gasto de renta": "gasto",
  "Gasto administrativo": "gasto",
};

const $ = (id) => document.getElementById(id);

function formatMoney(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(n || 0);
}

function nowStr() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function detectAmount(text, fallback) {
  const m = text.match(/\$?\s?(\d+(?:[\.,]\d{1,2})?)/);
  if (m) return Number(m[1].replace(",", "."));
  return Number(fallback || 0);
}

function parseOperation(text, manualAmount) {
  const lower = text.toLowerCase();
  const amount = detectAmount(text, manualAmount);
  const assumptions = [];

  if (!amount) {
    return { error: "No pude identificar el monto. Escribe un monto en el texto o en el campo de monto." };
  }

  let debit = "Caja";
  let credit = "Ingresos por servicios";
  let type = "ingreso_servicios";

  const isCredit = /a\s+cr[eé]dito|credito/.test(lower);
  const useBank = /banco|transferencia|dep[oó]sito/.test(lower);
  const useCash = /efectivo|caja|contado/.test(lower);

  if (useBank) debit = "Banco";
  if (!useBank && !useCash) assumptions.push("No se especificó medio de cobro/pago. Asumí 'Caja'.");

  if (/ingreso|cobr[eé]|obtuv|venta|servicio/.test(lower)) {
    type = "ingreso_servicios";
    debit = useBank ? "Banco" : "Caja";
    credit = "Ingresos por servicios";
  } else if (/renta|alquiler/.test(lower)) {
    type = "gasto_renta";
    debit = "Gasto de renta";
    if (isCredit) {
      credit = "Proveedores";
      assumptions.push("Se detectó 'a crédito'; registré una cuenta por pagar.");
    } else {
      credit = useBank ? "Banco" : "Caja";
      if (!useBank && !useCash) assumptions.push("No se especificó medio de pago. Asumí 'Caja'.");
    }
  } else if (/compr[eé]|compra/.test(lower) && /equipo|laptop|computadora/.test(lower)) {
    type = "compra_activo";
    debit = "Equipo de cómputo";
    credit = isCredit ? "Proveedores" : (useBank ? "Banco" : "Caja");
    if (isCredit) assumptions.push("Se clasificó como activo fijo por tipo de compra.");
  } else if (/aport[eé]|capital|inversi[oó]n/.test(lower)) {
    type = "aporte_capital";
    debit = useBank ? "Banco" : "Caja";
    credit = "Capital";
  } else if (/pag[ué]|pago|gast[oó]/.test(lower)) {
    type = "gasto_operativo";
    debit = "Gasto administrativo";
    credit = isCredit ? "Proveedores" : (useBank ? "Banco" : "Caja");
  }

  const explanation = {
    type,
    amount,
    debit,
    credit,
    confidence: assumptions.length ? "Media" : "Alta",
    question: assumptions.length > 0 ? "¿Deseas cambiar el medio de pago/cobro antes de guardar?" : null,
  };

  return {
    type,
    amount,
    assumptions,
    entryLines: [
      { account: debit, debit: amount, credit: 0 },
      { account: credit, debit: 0, credit: amount },
    ],
    explanation,
  };
}

function rebuildLedger() {
  state.ledger = state.operations.flatMap((op) => op.entryLines.map((l) => ({ ...l, date: op.date, input: op.input })));
}

function getAccountBalanceMap() {
  const map = {};
  for (const row of state.ledger) {
    if (!map[row.account]) map[row.account] = { debit: 0, credit: 0 };
    map[row.account].debit += row.debit;
    map[row.account].credit += row.credit;
  }
  return map;
}

function renderKPIs() {
  const incomes = state.ledger.filter((l) => accountNature[l.account] === "ingreso").reduce((s, l) => s + l.credit - l.debit, 0);
  const expenses = state.ledger.filter((l) => accountNature[l.account] === "gasto").reduce((s, l) => s + l.debit - l.credit, 0);
  const cajaBanco = state.ledger.filter((l) => ["Caja", "Banco"].includes(l.account)).reduce((s, l) => s + l.debit - l.credit, 0);
  $("kpiIngresos").textContent = formatMoney(incomes);
  $("kpiGastos").textContent = formatMoney(expenses);
  $("kpiUtilidad").textContent = formatMoney(incomes - expenses);
  $("kpiCaja").textContent = formatMoney(cajaBanco);
}

function renderEntries() {
  const tbody = $("entriesTable");
  tbody.innerHTML = "";
  state.ledger.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.date}</td><td>${r.account}</td><td>${r.debit ? formatMoney(r.debit) : ""}</td><td>${r.credit ? formatMoney(r.credit) : ""}</td><td title="${r.input}">${r.input.slice(0, 38)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderTAccounts() {
  const map = getAccountBalanceMap();
  const wrap = $("tAccounts");
  wrap.innerHTML = "";
  Object.entries(map).forEach(([acc, v]) => {
    const card = document.createElement("div");
    const saldo = v.debit - v.credit;
    card.className = "card";
    card.innerHTML = `<h4>${acc}</h4><p>Débitos: ${formatMoney(v.debit)}</p><p>Créditos: ${formatMoney(v.credit)}</p><p>Saldo: ${formatMoney(saldo)}</p>`;
    wrap.appendChild(card);
  });
}

function renderTrialBalance() {
  const map = getAccountBalanceMap();
  const tbody = $("trialBalance");
  tbody.innerHTML = "";
  let totalD = 0;
  let totalC = 0;
  Object.entries(map).forEach(([acc, v]) => {
    totalD += v.debit;
    totalC += v.credit;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${acc}</td><td>${formatMoney(v.debit)}</td><td>${formatMoney(v.credit)}</td><td>${formatMoney(v.debit - v.credit)}</td>`;
    tbody.appendChild(tr);
  });
  const totalTr = document.createElement("tr");
  totalTr.innerHTML = `<td><strong>Total</strong></td><td><strong>${formatMoney(totalD)}</strong></td><td><strong>${formatMoney(totalC)}</strong></td><td>${totalD === totalC ? "✅ Cuadrada" : "❌ Desc cuadrada"}</td>`;
  tbody.appendChild(totalTr);
  $("cycleHealth").textContent = `Estado general: ${totalD === totalC ? "✅ Correcto" : "❌ Error en balanza"}`;
}

function renderStatements() {
  const map = getAccountBalanceMap();
  let ingresos = 0, gastos = 0;
  let activos = 0, pasivos = 0, patrimonio = 0;

  Object.entries(map).forEach(([acc, v]) => {
    const bal = v.debit - v.credit;
    const n = accountNature[acc];
    if (n === "ingreso") ingresos += v.credit - v.debit;
    if (n === "gasto") gastos += v.debit - v.credit;
    if (n === "activo") activos += bal;
    if (n === "pasivo") pasivos += -bal;
    if (n === "patrimonio") patrimonio += -bal;
  });

  const utilidad = ingresos - gastos;
  $("incomeStatement").innerHTML = `
    <p><span>Ingresos</span><strong>${formatMoney(ingresos)}</strong></p>
    <p><span>Gastos</span><strong>${formatMoney(gastos)}</strong></p>
    <p><span>Utilidad neta</span><strong>${formatMoney(utilidad)}</strong></p>
  `;

  $("balanceSheet").innerHTML = `
    <p><span>Activos</span><strong>${formatMoney(activos)}</strong></p>
    <p><span>Pasivos</span><strong>${formatMoney(pasivos)}</strong></p>
    <p><span>Patrimonio</span><strong>${formatMoney(patrimonio + utilidad)}</strong></p>
    <p><span>Pasivo + Patrimonio</span><strong>${formatMoney(pasivos + patrimonio + utilidad)}</strong></p>
  `;
}

function renderTimeline() {
  const list = $("timeline");
  list.innerHTML = "";
  state.operations.slice().reverse().forEach((op, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${op.date} · ${op.input}</span><span><span class="badge">${op.explanation.confidence}</span></span>`;
    list.appendChild(li);
  });
}

function renderProgress() {
  const pct = Math.min(100, state.operations.length * 15);
  $("progressBar").style.width = `${pct}%`;
  $("cyclePercent").textContent = `${pct}%`;
}

function rerenderAll() {
  rebuildLedger();
  renderKPIs();
  renderEntries();
  renderTAccounts();
  renderTrialBalance();
  renderStatements();
  renderTimeline();
  renderProgress();
}

function showInterpretation(res) {
  const assumptions = $("assumptions");
  const explanation = $("explanation");
  const impact = $("impactPreview");

  assumptions.classList.toggle("hidden", !res.assumptions.length);
  assumptions.innerHTML = res.assumptions.length
    ? `<strong>Supuestos inteligentes:</strong><ul>${res.assumptions.map((a) => `<li>${a}</li>`).join("")}</ul>`
    : "";

  explanation.classList.remove("hidden");
  explanation.innerHTML = `
    <strong>Interpretación:</strong> ${res.explanation.type}<br/>
    <strong>Débito:</strong> ${res.explanation.debit} (${formatMoney(res.amount)})<br/>
    <strong>Crédito:</strong> ${res.explanation.credit} (${formatMoney(res.amount)})<br/>
    <strong>Confianza:</strong> ${res.explanation.confidence}
    ${state.mode === "learn" ? `<br/><em>Regla aplicada: activos/gastos aumentan al débito; ingresos/pasivos/patrimonio al crédito.</em>` : ""}
    ${res.explanation.question ? `<br/><span class="badge">${res.explanation.question}</span>` : ""}
  `;

  impact.innerHTML = `${res.entryLines[0].account} (D ${formatMoney(res.amount)}) → ${res.entryLines[1].account} (C ${formatMoney(res.amount)})`;
}

function addOperation(input, amount) {
  const parsed = parseOperation(input, amount);
  if (parsed.error) {
    alert(parsed.error);
    return;
  }
  showInterpretation(parsed);
  state.operations.push({
    id: crypto.randomUUID(),
    input,
    date: nowStr(),
    ...parsed,
  });
  rerenderAll();
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  });
});

$("modeLearn").addEventListener("click", () => {
  state.mode = "learn";
  $("modeLearn").classList.add("active");
  $("modeFast").classList.remove("active");
});
$("modeFast").addEventListener("click", () => {
  state.mode = "fast";
  $("modeFast").classList.add("active");
  $("modeLearn").classList.remove("active");
});

$("analyzeBtn").addEventListener("click", () => {
  const input = $("nlInput").value.trim();
  const amount = $("amountInput").value;
  if (!input) return alert("Escribe primero una operación.");
  addOperation(input, amount);
});

$("clearBtn").addEventListener("click", () => {
  $("nlInput").value = "";
  $("amountInput").value = "";
  $("assumptions").classList.add("hidden");
  $("explanation").classList.add("hidden");
  $("impactPreview").textContent = "Aún no hay operación interpretada.";
});

document.querySelectorAll(".suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("nlInput").value = btn.textContent;
  });
});

rerenderAll();
