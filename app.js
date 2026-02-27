const API_URL = "https://script.google.com/macros/s/AKfycbxFtd8kHB2zyFYCdMyDF1zBWtbxbFrmbIIvWSnkst1NdxDxwVipx3hz9iKLPhF5KUb6/exec";
let LOGADO = false;

/* ================= LOGIN ================= */
async function login() {
  const nome = loginNome.value;
  const senha = loginSenha.value;

  const res = await api({
    entity: "users",
    action: "login",
    payload: { nome, senha }
  });

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
  location.reload();
}

/* ================= ESCALA ================= */
async function loadEscala() {
  const dados = await api({ entity: "escala", action: "list" });
  renderEscala(dados);
}

function renderEscala(lista) {
  content.innerHTML = `<h2 class="font-bold mb-3">Escala</h2>`;

  lista.forEach(e => {
    content.innerHTML += `
      <div class="card">
        <b>${e.data}</b><br>
        ${e.nome_oficiante}<br>
        ${e.setor} • ${e.turno}<br>
        ${e.hora_inicial} - ${e.hora_final}
      </div>
    `;
  });
}

/* ================= OFICIANTES ================= */
async function loadOficiantes() {
  const lista = await api({ entity: "oficiantes", action: "list" });
  content.innerHTML = `<h2 class="font-bold mb-3">Oficiantes</h2>`;

  lista.forEach(o => {
    content.innerHTML += `
      <div class="card text-center">
        <img src="${o.foto1}" class="w-16 h-16 rounded-full mx-auto mb-2">
        <b>${o.nome}</b>
      </div>
    `;
  });
}

/* ================= API ================= */
async function api(payload) {
  const r = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return r.json();
}

