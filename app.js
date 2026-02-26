const API_KEY = "AIzaSyBNec6Rf82zw8POHalMgM8YHdFkQlHUTVg"; 
const SPREADSHEET_ID = "1XggtZLa9j4d7x1JTm-7RMwnh9OqKQafAFpFut4lLx4U"; 

let dataStore = { escala: [], oficiantes: [] };
let isAdmin = true; // Permite usar os botões de salvar/excluir diretamente

window.onload = function() {
  // Inicializa o motor do Google apenas para leitura
  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    });
    // Carrega os dados da planilha automaticamente
    loadData();
  });
};

async function loadData() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ["ESCALA!A2:G", "OFICIANTES!A2:D"]
    });

    const valueRanges = res.result.valueRanges;
    
    // Mapeia os dados da escala e oficiantes
    dataStore.escala = (valueRanges[0].values || []).map((r, i) => ({
      row: i + 2, setor: r[0], data: r[1], turno: r[2],
      id_oficiante: r[3], nome: r[4], hora_i: r[5] || "", hora_f: r[6] || ""
    }));

    dataStore.oficiantes = (valueRanges[1].values || []).map(r => ({
      id: r[0], nome: r[1], foto1: r[2]
    }));

    fillOficiantes();
    renderEscala();
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
    // Se der erro aqui, é porque a planilha não está com acesso "Qualquer pessoa com o link"
  }
}

// Mantenha suas funções fillOficiantes, renderEscala, salvarEscala e excluir abaixo deste ponto
