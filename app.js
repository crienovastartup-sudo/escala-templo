const API_URL = "https://script.google.com/macros/s/AKfycbxQ-dhtZP0a0Uq2jtn4HiT1Cc3R0Ljy20zsyRx_SipiRbA_Cce5XofZSIkmrVJQkkvXsQ/exec";
let LOGADO = false;

/* ================= LOGIN ================= */

function login(){
  alert("Botão Entrar clicado"); // 🔎 TESTE VISUAL

  const nome = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "login",
      nome: nome,
      senha: senha
    })
  })
  .then(r => r.json())
  .then(res => {
    if(res.status === "ok"){
      alert("Login realizado com sucesso!");

      document.getElementById("login").style.display = "none";
      document.getElementById("app").style.display = "block";
    } else {
      alert(res.msg || "Usuário ou senha inválidos");
    }
  })
  .catch(err => {
    alert("Erro ao conectar com o servidor");
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




