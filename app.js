const API_URL = "https://script.google.com/macros/s/AKfycbxQ-dhtZP0a0Uq2jtn4HiT1Cc3R0Ljy20zsyRx_SipiRbA_Cce5XofZSIkmrVJQkkvXsQ/exec";

const loginBox = document.getElementById("loginBox");
const content = document.getElementById("content");

let LOGADO = false;

/* ================= LOGIN ================= */

async function login() {
  const nome = loginNome.value;
  const senha = loginSenha.value;

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "login",
      nome,
      senha
    })
  }).then(r => r.json());

  if (res.status === "ok") {
    LOGADO = true;
    loginBox.classList.add("hidden");
    content.classList.remove("hidden");
    loadEscala();
  } else {
    alert(res.message);
  }
}

function logout() {
  LOGADO = false;
  content.classList.add("hidden");
  loginBox.classList.remove("hidden");
}

/* ================= ESCALA ================= */

async function loadEscala() {
  const res = await api("listEscala");

  let html = `<h2 class="font-bold mb-3">Escala</h2>`;

  res.forEach(e => {
    html += `
      <div class="card">
        <strong>${e.nome_oficiante}</strong><br>
        ${e.setor} • Turno ${e.turno}<br>
        ${formatDate(e.data)}
      </div>
    `;
  });

  content.innerHTML = html;
}

/* ================= OFICIANTES ================= */

async function loadOficiantes() {
  const res = await api("listOficiantes");

  let html = `<h2 class="font-bold mb-3">Oficiantes</h2>`;

  res.forEach(o => {
    html += `
      <div class="card flex gap-2 items-center">
        <img src="${o.foto1 || 'https://via.placeholder.com/40'}" width="40">
        <strong>${o.nome}</strong>
      </div>
    `;
  });

  content.innerHTML = html;
}

/* ================= API ================= */

async function api(action, payload = {}) {
  return fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...payload })
  }).then(r => r.json());
}

/* ================= UTIL ================= */

function formatDate(d) {
  return new Date(d).toLocaleDateString("pt-BR");
}
