const API = "SUA_URL_DO_APPS_SCRIPT";

let isAdmin = false;

// 🔐 LOGIN
async function login() {
  const user = loginUser.value;
  const pass = loginPass.value;

  const res = await fetch(API, {
    method: "POST",
    body: JSON.stringify({ action:"login", user, pass })
  }).then(r=>r.json());

  if(res.ok){
    isAdmin = true;
    loginBox.classList.add("hidden");
    logoutBox.classList.remove("hidden");
    btnAdd.classList.remove("hidden");
  } else alert("Login inválido");
}

function logout(){
  isAdmin = false;
  location.reload();
}

// 📅 CALENDÁRIO
async function loadCalendar(){
  const data = await fetch(API,{
    method:"POST",
    body:JSON.stringify({action:"listEscala"})
  }).then(r=>r.json());

  calendar.innerHTML = data.map(d=>`
    <div class="border rounded-xl p-3">
      <strong>${d.data}</strong>
      <div class="text-sm">${d.nome_oficiante} • ${d.setor} • Turno ${d.turno}</div>
    </div>
  `).join("");
}

// 📄 PDF
function gerarPDF(){
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.text("Escala Mensal",10,10);
  pdf.save("escala.pdf");
}

loadCalendar();
