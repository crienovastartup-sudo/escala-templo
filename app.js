const API_KEY = "AIzaSyBNec6Rf82zw8POHalMgM8YHdFkQlHUTVg"; 
const SPREADSHEET_ID = "1XggtZLa9j4d7x1JTm-7RMwnh9OqKQafAFpFut4lLx4U"; 

let dataStore = { escala: [], oficiantes: [] };
let isAdmin = true; // Ativa as funções de salvar/excluir para todos

// Carrega tudo automaticamente ao abrir o site
window.onload = function() {
  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    });
    loadData(); // Chama a leitura dos dados na hora
  });
};

async function loadData() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ["ESCALA!A2:G", "OFICIANTES!A2:D"]
    });

    const [escalaRaw, ofRaw] = res.result.valueRanges;

    dataStore.escala = (escalaRaw.values || []).map((r, i) => ({
      row: i + 2, setor: r[0], data: r[1], turno: r[2],
      id_oficiante: r[3], nome: r[4], hora_i: r[5] || "", hora_f: r[6] || ""
    }));

    dataStore.oficiantes = (ofRaw.values || []).map(r => ({
      id: r[0], nome: r[1], foto1: r[2]
    }));

    fillOficiantes();
    renderEscala();
    
    // Esconde a caixa de login se ela ainda existir no HTML
    if(document.getElementById("loginBox")) document.getElementById("loginBox").style.display = "none";
    if(document.getElementById("app")) document.getElementById("app").style.display = "block";

  } catch (e) {
    console.error("Erro ao carregar:", e);
    alert("Erro ao acessar a planilha pública. Verifique o compartilhamento.");
  }
}

// ... mantenha suas funções fillOficiantes, renderEscala, salvarEscala e excluir abaixo ...
