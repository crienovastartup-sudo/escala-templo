const API_URL = "https://script.google.com/macros/s/AKfycbxlue6Nx3_6kmhxjNtbFfdfSULR_SBwgVVi3zQ-8rhGdPuXaJd_i276Ed_OMBj4MJ1QnQ/exec";

let admin = localStorage.getItem("admin") === "true";
let oficiantes = [];
let escala = [];

async function api(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return res.json();
}

function diaSemana(data) {
  return ["domingo","segunda","terça","quarta","quinta","sexta","sábado"][new Date(data).getDay()];
}

async function carregarDados() {
  oficiantes = await api({ action: "listOficiantes" });
  escala = await api({ action: "listEscala" });
  renderFilters();
  renderEscala();
}

function renderFilters() {
  const sel = document.getElementById("filterOficiante");
  sel.innerHTML = `<option value="">Todos os oficiantes</option>`;
  oficiantes.forEach(o => {
    sel.innerHTML += `<option value="${o.id_oficiante}">${o.nome}</option>`;
  });
}

function renderEscala() {
  const area = document.getElementById("escala");
  area.innerHTML = "";

  const fs = filterSetor.value;
  const ft = filterTurno.value;
  const fo = filterOficiante.value;

  escala
    .filter(e => (!fs || e.setor === fs))
    .filter(e => (!ft || e.turno == ft))
    .filter(e => (!fo || e.id_oficiante === fo))
    .forEach(e => {
      area.innerHTML += `
        <div class="card setor-${e.setor}">
          <img src="${e.foto1}">
          <div>
            <strong>${e.nome_oficiante}</strong><br>
            ${e.data} (${diaSemana(e.data)})<br>
            ${e.setor} • Turno ${e.turno}
            ${e.hora_inicial ? `<br>${e.hora_inicial} - ${e.hora_final}` : ``}
          </div>
        </div>
      `;
    });
}

document.getElementById("loginBtn").onclick = () => {
  document.getElementById("loginModal").classList.remove("hidden");
};

function closeLogin() {
  document.getElementById("loginModal").classList.add("hidden");
}

document.getElementById("loginForm").onsubmit = async e => {
  e.preventDefault();
  const nome = loginNome.value;
  const senha = loginSenha.value;

  const res = await api({ action: "login", nome, senha });
  if (res.success) {
    admin = true;
    localStorage.setItem("admin", "true");
    document.querySelectorAll(".admin").forEach(b => b.classList.remove("hidden"));
    document.getElementById("logoutBtn").classList.remove("hidden");
    closeLogin();
  } else {
    alert("Usuário ou senha inválidos");
  }
};

logoutBtn.onclick = () => {
  admin = false;
  localStorage.removeItem("admin");
  location.reload();
};

addEscalaBtn.onclick = () => {
  document.getElementById("escalaModal").classList.remove("hidden");
  escalaOficiante.innerHTML = oficiantes.map(o =>
    `<option value="${o.id_oficiante}">${o.nome}</option>`
  ).join("");
};

function closeEscala() {
  document.getElementById("escalaModal").classList.add("hidden");
}

escalaForm.onsubmit = async e => {
  e.preventDefault();

  const res = await api({
    action: "addEscala",
    setor: escalaSetor.value,
    data: escalaData.value,
    turno: escalaTurno.value,
    id_oficiante: escalaOficiante.value,
    hora_inicial: horaInicial.value,
    hora_final: horaFinal.value
  });

  if (res.error) {
    alert(res.error);
    return;
  }

  closeEscala();
  await carregarDados();
};

["filterSetor","filterTurno","filterOficiante"].forEach(id => {
  document.getElementById(id).onchange = renderEscala;
});

if (admin) {
  document.querySelectorAll(".admin").forEach(b => b.classList.remove("hidden"));
  document.getElementById("logoutBtn").classList.remove("hidden");
}

carregarDados();
