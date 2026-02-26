const CLIENT_ID = "965874692359-5sqoflo5ipp0dbb09menbs7iqfibeofc.apps.googleusercontent.com";
const API_KEY = "AIzaSyBNec6Rf82zw8POHalMgM8YhdFkQlHUTVg";
const SPREADSHEET_ID = "1XggtZLa9j4d7x1JTm-7RMwnh9OqKQafAFpFut4lLx4U";

let tokenClient;
let dataStore = { escala: [], oficiantes: [], users: [] };
let isAdmin = false;

gapiLoaded();
gisLoaded();

function gapiLoaded() {
  gapi.load("client", async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"]
    });
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback: async () => {
      await loadData();
    }
  });
}

function authenticate() {
  tokenClient.requestAccessToken({ prompt: "consent" });
}

// Altere a função loadData para garantir a leitura correta das colunas
async function loadData() {
  const res = await gapi.client.sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ["ESCALA!A2:G", "OFICIANTES!A2:D", "USERS!A2:C"]
  });

  const [escalaRaw, ofRaw, usersRaw] = res.result.valueRanges;

  // Mapeia os usuários: r[1] é a Coluna B (NOME), r[2] é a Coluna C (SENHA)
  dataStore.users = (usersRaw.values || []).map(r => ({
    nome: r[1] ? r[1].trim() : "", 
    senha: r[2] ? r[2].trim() : ""
  }));

  // Carrega o restante dos dados
  dataStore.escala = (escalaRaw.values || []).map((r, i) => ({
    row: i + 2, setor: r[0], data: r[1], turno: r[2],
    id_oficiante: r[3], nome: r[4], hora_i: r[5] || "", hora_f: r[6] || ""
  }));

  dataStore.oficiantes = (ofRaw.values || []).map(r => ({
    id: r[0], nome: r[1], foto1: r[2], foto2: r[3]
  }));

  fillOficiantes();
  renderEscala();
}

async function login() {
  const msg = document.getElementById("loginMsg");
  msg.innerText = "Autorizando com Google...";

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      msg.innerText = "Erro na autorização do Google.";
      throw (resp);
    }

    // PASSO CRUCIAL: Aguarda o carregamento dos dados da aba USERS
    msg.innerText = "Sincronizando com a planilha...";
    const carregou = await loadData(); 

    if (!carregou) {
      msg.innerText = "Erro ao ler dados. Verifique se a API KEY está no código.";
      return;
    }

    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value.trim();
    
    // Comparação exata com a sua planilha (david / teste123)
    const usuarioValido = dataStore.users.find(x => 
      String(x.nome).toLowerCase() === String(u).toLowerCase() && 
      String(x.senha) === String(p)
    );

    if (usuarioValido) {
      isAdmin = true;
      document.getElementById("loginBox").style.display = "none";
      document.getElementById("app").style.display = "block";
    } else {
      msg.innerText = "Usuário ou senha não encontrados na aba USERS.";
    }
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}
function fillOficiantes(){
  const sel=document.getElementById("oficiante");
  sel.innerHTML="";
  dataStore.oficiantes.forEach(o=>{
    const op=document.createElement("option");
    op.value=o.id;
    op.text=o.nome;
    sel.appendChild(op);
  });
}

function validar(payload){
  if(payload.setor==="Recepção"){
    if(!payload.hora_i||!payload.hora_f) return false;
    if(payload.turno==1 && payload.hora_i<"07:00") return false;
    if(payload.turno==2 && payload.hora_i<"12:00") return false;
    if(payload.turno==3 && payload.hora_i<"17:00") return false;
  }
  return true;
}

async function salvarEscala(){
  if(!isAdmin) return alert("Sem permissão");

  const payload={
    setor:setor.value,
    data:data.value,
    turno:turno.value,
    id_oficiante:oficiante.value,
    nome:dataStore.oficiantes.find(o=>o.id==oficiante.value).nome,
    hora_i:horaInicio.value,
    hora_f:horaFim.value
  };

  const dup=dataStore.escala.find(e=>e.data==payload.data && e.turno==payload.turno && e.id_oficiante==payload.id_oficiante);
  if(dup) return alert("Duplicado!");

  if(!validar(payload)) return alert("Horário inválido");

  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId:SPREADSHEET_ID,
    range:"ESCALA!A:G",
    valueInputOption:"USER_ENTERED",
    resource:{values:[[payload.setor,payload.data,payload.turno,payload.id_oficiante,payload.nome,payload.hora_i,payload.hora_f]]}
  });

  loadData();
}

function renderEscala(){
  const tbody=document.querySelector("#tabela tbody");
  tbody.innerHTML="";

  dataStore.escala.forEach(e=>{
    const tr=document.createElement("tr");
    tr.className=e.setor;

    const ofic=dataStore.oficiantes.find(o=>o.id==e.id_oficiante);

    tr.innerHTML=`
    <td>${e.data}</td>
    <td>${new Date(e.data).toLocaleDateString("pt-BR",{weekday:"long"})}</td>
    <td><img src="${ofic?.foto1||""}"></td>
    <td>${e.nome}</td>
    <td>${e.setor}</td>
    <td>${e.turno}</td>
    <td>${e.hora_i} - ${e.hora_f}</td>
    <td>${isAdmin?`<button onclick="excluir(${e.row})">X</button>`:""}</td>`;
    tbody.appendChild(tr);
  });
}

async function excluir(row){
  if(!confirm("Excluir?")) return;

  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId:SPREADSHEET_ID,
    resource:{requests:[{deleteDimension:{range:{sheetId:0,dimension:"ROWS",startIndex:row-1,endIndex:row}}}]}
  });

  loadData();
}

function gerarPDF(){
  window.print();

}



