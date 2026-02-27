const API_URL = "https://script.google.com/macros/s/AKfycbxFtd8kHB2zyFYCdMyDF1zBWtbxbFrmbIIvWSnkst1NdxDxwVipx3hz9iKLPhF5KUb6/exec";
let LOGADO = false;

/* ================= LOGIN ================= */

function login(){
  const nome = document.getElementById("usuario").value;
  const senha = document.getElementById("senha").value;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "login",
      nome,
      senha
    })
  })
  .then(r => r.json())
  .then(res => {
    if(res.status === "ok"){
      alert("Login realizado com sucesso");
      localStorage.setItem("user", res.user);
      document.getElementById("login").style.display = "none";
      document.getElementById("app").style.display = "block";
    } else {
      alert(res.msg);
    }
  })
  .catch(err => {
    alert("Erro de conexão");
    console.error(err);
  });
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


