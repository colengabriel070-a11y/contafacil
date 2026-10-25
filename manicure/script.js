
"use strict";

const $ = id => document.getElementById(id);
const KEY = "contafacil-v3";

const fresh = () => ({
  services: [],
  appointments: [],
  purchases: []
});

let db = fresh();

try {
  const loaded = JSON.parse(localStorage.getItem(KEY));
  if (loaded && typeof loaded === "object") {
    for (const k of Object.keys(db)) {
      if (Array.isArray(loaded[k])) db[k] = loaded[k];
    }
  }
} catch (e) {
  console.warn("Não foi possível carregar os dados.", e);
}

let editing = null;
let pending = [];

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

const now = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = n => Number(n).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const safe = s => String(s).replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    alert("Não foi possível salvar. Verifique o armazenamento do navegador.");
    return false;
  }
}

$("month").value = now().slice(0, 7);
$("appointmentDate").value = now();
$("purchaseDate").value = now();

// CADASTRAR E EDITAR SERVIÇOS

$("serviceForm").addEventListener("submit", e => {
  e.preventDefault();

  const name = $("serviceName").value.trim();
  const price = Number($("servicePrice").value);

  if (!name || !Number.isFinite(price) || price < 0) {
    return alert("Preencha o nome e o preço do serviço.");
  }

  if (editing) {
    const s = db.services.find(s => s.id === editing);
    if (s) {
      s.name = name;
      s.price = price;
    }
  } else {
    db.services.push({
      id: uuid(),
      name,
      price
    });
  }

  if (!save()) return;

  editing = null;
  $("serviceForm").reset();
  $("cancelEdit").hidden = true;
  $("serviceSubmit").textContent = "Salvar serviço";
  render();
});

$("cancelEdit").onclick = () => {
  editing = null;
  $("serviceForm").reset();
  $("cancelEdit").hidden = true;
  $("serviceSubmit").textContent = "Salvar serviço";
};

// SELECIONAR SERVIÇO E PREÇO

$("serviceSelect").addEventListener("change", () => {
  const s = db.services.find(
    s => s.id === $("serviceSelect").value
  );

  if (s) {
    $("charged").value = s.price.toFixed(2);
    $("paid").value = s.price.toFixed(2);
  }
});

// REGISTRAR ATENDIMENTO

$("appointmentForm").addEventListener("submit", e => {
  e.preventDefault();

  const s = db.services.find(
    s => s.id === $("serviceSelect").value
  );

  const client = $("client").value.trim();
  const charged = Number($("charged").value);
  const paid = Number($("paid").value);
  const date = $("appointmentDate").value;

  if (
    !s || !client || !date ||
    !Number.isFinite(charged) ||
    !Number.isFinite(paid) ||
    charged < 0 || paid < 0 || paid > charged
  ) {
    return alert("Confira os dados do atendimento.");
  }

  db.appointments.push({
    id: uuid(),
    serviceId: s.id,
    serviceName: s.name,
    client,
    charged,
    paid,
    date
  });

  if (!save()) return;

  $("month").value = date.slice(0, 7);
  $("appointmentForm").reset();
  $("appointmentDate").value = now();
  render();
});

// ADICIONAR PRODUTOS À LISTA

$("addProduct").onclick = () => {
  const name = $("product").value.trim();
  const quantity = Number($("quantity").value);
  const unit = Number($("unit").value);

  if (
    !name ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unit) ||
    unit < 0
  ) {
    return alert("Preencha o produto, a quantidade e o preço.");
  }

  pending.push({
    id: uuid(),
    name,
    quantity,
    unit
  });

  $("product").value = "";
  $("quantity").value = "1";
  $("unit").value = "";
  renderPending();
  $("product").focus();
};

// SALVAR COMPRAS EM LOTE

$("saveBatch").onclick = () => {
  if (!pending.length) {
    return alert("Adicione produtos à lista antes de salvar.");
  }

  const date = $("purchaseDate").value;

  if (!date) {
    return alert("Escolha a data da compra.");
  }

  db.purchases.push(
    ...pending.map(p => ({ ...p, date }))
  );

  if (!save()) return;

  pending = [];
  $("month").value = date.slice(0, 7);
  render();
  alert("Todas as compras foram salvas!");
};

// EDITAR E EXCLUIR REGISTROS

document.addEventListener("click", e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;

  const action = b.dataset.action;
  const id = b.dataset.id;

  if (action === "removePending") {
    pending = pending.filter(p => p.id !== id);
    renderPending();
    return;
  }

  if (action === "editService") {
    const s = db.services.find(s => s.id === id);
    if (!s) return;

    editing = s.id;
    $("serviceName").value = s.name;
    $("servicePrice").value = s.price;
    $("serviceSubmit").textContent = "Atualizar serviço";
    $("cancelEdit").hidden = false;
    $("serviceName").focus();
    return;
  }

  const map = {
    deleteService: "services",
    deleteAppointment: "appointments",
    deletePurchase: "purchases"
  };

  const collection = map[action];

  if (!collection || !confirm("Excluir este registro?")) {
    return;
  }

  db[collection] = db[collection].filter(
    x => x.id !== id
  );

  if (editing === id) editing = null;

  if (save()) render();
});

$("month").addEventListener("change", render);

// LISTA DE PRODUTOS A SALVAR

function renderPending() {
  $("pendingList").innerHTML = pending.map(p => `
    <tr>
      <td>${safe(p.name)}</td>
      <td>${p.quantity}</td>
      <td>${money(p.unit)}</td>
      <td>${money(p.quantity * p.unit)}</td>
      <td>
        <button class="danger"
          data-action="removePending"
          data-id="${p.id}">
          Remover
        </button>
      </td>
    </tr>
  `).join("") ||
    '<tr><td colspan="5">Nenhum produto na lista.</td></tr>';

  $("pendingTotal").textContent =
    "Total da lista: " +
    money(pending.reduce(
      (t, p) => t + p.quantity * p.unit, 0
    ));
}

// RELATÓRIO DO MÊS

function report() {
  const month = $("month").value;

  const a = db.appointments.filter(
    x => x.date.startsWith(month)
  );

  const p = db.purchases.filter(
    x => x.date.startsWith(month)
  );

  return {
    month,
    a,
    p,
    received: a.reduce((t, x) => t + x.paid, 0),
    spent: p.reduce(
      (t, x) => t + x.quantity * x.unit, 0
    )
  };
}

// ATUALIZAR INFORMAÇÕES NA TELA

function render() {
  const selected = $("serviceSelect").value;

  $("serviceSelect").innerHTML =
    '<option value="">Selecione um serviço</option>' +
    db.services.map(s => `
      <option value="${safe(s.id)}">
        ${safe(s.name)} — ${money(s.price)}
      </option>
    `).join("");

  if (db.services.some(s => s.id === selected)) {
    $("serviceSelect").value = selected;
  }

  $("serviceList").innerHTML = db.services.map(s => `
    <li>
      ${safe(s.name)} — ${money(s.price)}
      <button class="secondary"
        data-action="editService"
        data-id="${safe(s.id)}">
        Editar
      </button>
      <button class="danger"
        data-action="deleteService"
        data-id="${safe(s.id)}">
        Excluir
      </button>
    </li>
  `).join("") || "<li>Nenhum serviço cadastrado.</li>";

  const r = report();

  $("received").textContent = money(r.received);
  $("spent").textContent = money(r.spent);
  $("balance").textContent = money(r.received - r.spent);
  $("attCount").textContent = r.a.length;

  $("appointmentsList").innerHTML = r.a.map(x => `
    <tr>
      <td>${safe(x.date)}</td>
      <td>${safe(x.client)}</td>
      <td>${safe(x.serviceName)}</td>
      <td>${money(x.charged)}</td>
      <td>${money(x.paid)}</td>
      <td>${money(x.charged - x.paid)}</td>
      <td>
        <button class="danger"
          data-action="deleteAppointment"
          data-id="${safe(x.id)}">
          Excluir
        </button>
      </td>
    </tr>
  `).join("") ||
    '<tr><td colspan="7">Nenhum atendimento neste mês.</td></tr>';

  $("purchasesList").innerHTML = r.p.map(x => `
    <tr>
      <td>${safe(x.date)}</td>
      <td>${safe(x.name)}</td>
      <td>${x.quantity}</td>
      <td>${money(x.unit)}</td>
      <td>${money(x.quantity * x.unit)}</td>
      <td>
        <button class="danger"
          data-action="deletePurchase"
          data-id="${safe(x.id)}">
          Excluir
        </button>
      </td>
    </tr>
  `).join("") ||
    '<tr><td colspan="6">Nenhuma compra neste mês.</td></tr>';

  renderPending();
}

// EXPORTAR RELATÓRIO CSV

$("exportCSV").onclick = () => {
  const r = report();

  const rows = [
    [
      "Categoria", "Data", "Cliente ou produto",
      "Serviço", "Quantidade", "Cobrado",
      "Recebido", "Custo"
    ],
    ...r.a.map(x => [
      "Atendimento", x.date, x.client,
      x.serviceName, "", x.charged, x.paid, ""
    ]),
    ...r.p.map(x => [
      "Compra", x.date, x.name,
      "", x.quantity, "", "",
      x.quantity * x.unit
    ])
  ];

  const csv = "\ufeff" + rows.map(row =>
    row.map(v =>
      '"' + String(v ?? "").replace(/"/g, '""') + '"'
    ).join(";")
  ).join("\r\n");

  download(
    csv,
    `relatorio-${r.month}.csv`,
    "text/csv;charset=utf-8"
  );
};

// BACKUP DOS DADOS

$("backupJSON").onclick = () => {
  download(
    JSON.stringify(db, null, 2),
    "contafacil-backup.json",
    "application/json"
  );
};

function download(content, name, type) {
  const url = URL.createObjectURL(
    new Blob([content], { type })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

render();
