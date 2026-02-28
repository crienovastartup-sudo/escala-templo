/**
 * Configurações Globais e Variáveis de Estado
 */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";
const CLOUD_NAME = "dwlrxb6a0";
const UPLOAD_PRESET = "ml_default";

const CONFIG_TURNOS = {
    "PRIMEIRO": { inicio: "07:00", fim: "12:00" },
    "SEGUNDO":  { inicio: "12:00", fim: "17:00" },
    "TERCEIRO": { inicio: "17:00", fim: "21:00" },
    "MANHÃ":    { inicio: "07:00", fim: "13:00" },
    "TARDE":    { inicio: "13:00", fim: "19:00" }
};

let oficiantes = []; 
let escala = [];      
let calendar;        
let currentUser = null; 

/**
 * Inicialização do Sistema
 */
window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCalendar();
    fetchData();
    setupEventListeners();
};

function setupEventListeners() {
    const setorSelect = document.getElementById('escala-setor');
    if (setorSelect) {
        setorSelect.addEventListener('change', (e) => {
            const isRecepcao = e.target.value.toUpperCase() === 'RECEPÇÃO';
            const hourFields = document.getElementById('escala-horas-container');
            if (hourFields) hourFields.classList.toggle('hidden', !isRecepcao);
        });
    }

    ['filter-setor', 'filter-turno', 'filter-oficiante'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyFilters);
    });
}

/**
 * Chamada Genérica para a API com Retentativas
 */
async function apiCall(data) {
    showLoading(true);
    let retries = 5;
    let delay = 1000;

    while (retries > 0) {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            const json = await res.json();
            showLoading(false);
            return json;
        } catch (e) {
            retries--;
            if (retries === 0) {
                showLoading(false);
                console.error("Erro final na API após retentativas:", e);
                return { status: "error", message: "Falha na comunicação com o servidor. Verifique sua ligação." };
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

/**
 * Upload de Imagens para o Cloudinary
 */
async function uploadParaCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Erro no Cloudinary");
        return data.secure_url || ""; 
    } catch (error) {
        console.error("Falha no upload Cloudinary:", error);
        throw error;
    }
}

/**
 * Configuração do FullCalendar (Correção de Tradução e Exibição)
 */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
        locale: 'pt-br',
        height: 'auto',
        timeZone: 'UTC', // Força UTC para evitar alteração de fuso horário nas datas puras
        buttonText: {
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            list: 'Agenda'
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listWeek'
        },
        allDayText: 'Dia Todo', // Remove "all-day"
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            const setor = (ext.setor || "").toUpperCase();
            let colorClass = "card-default";
            
            if (setor.includes("BATISTÉRIO")) colorClass = "card-batisterio";
            else if (setor.includes("RECEPÇÃO")) colorClass = "card-recepcao";
            else if (setor.includes("SELAMENTO")) colorClass = "card-selamento";

            let html = `
                <div class="event-card-custom ${colorClass}" style="border-left: 4px solid currentColor; padding: 4px; min-height: 55px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="font-weight: 800; font-size: 11px; line-height: 1.1; color: #1e293b; margin-bottom: 2px;">
                            ${arg.event.title}
                        </div>
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                            ${ext.turno}
                        </div>
                    </div>
                    <div class="flex -space-x-2 mt-1 justify-end">
                        ${ext.foto1 ? `<img src="${ext.foto1}" style="width: 26px; height: 26px; border-radius: 999px; border: 2px solid white; object-fit: cover; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : ''}
                        ${ext.foto2 ? `<img src="${ext.foto2}" style="width: 26px; height: 26px; border-radius: 999px; border: 2px solid white; object-fit: cover; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : ''}
                    </div>
                </div>
            `;
            return { html };
        }
    });
    calendar.render();
}

/**
 * Filtros e Sincronização
 */
function applyFilters() {
    const filterSetor = document.getElementById('filter-setor')?.value;
    const filterTurno = document.getElementById('filter-turno')?.value;
    const filterOfiId = document.getElementById('filter-oficiante')?.value;

    if (!calendar) return;
    calendar.removeAllEvents();
    
    const filtrados = escala.filter(item => {
        const matchSetor = !filterSetor || item.setor === filterSetor;
        const matchTurno = !filterTurno || item.turno === filterTurno;
        const matchOfi = !filterOfiId || String(item.id_oficiante) === String(filterOfiId);
        return matchSetor && matchTurno && matchOfi;
    });

    filtrados.forEach(e => {
        const ofi = oficiantes.find(o => String(o.id) === String(e.id_oficiante));
        calendar.addEvent({
            title: e.nome_oficiante,
            start: e.data, 
            allDay: true,
            extendedProps: {
                setor: e.setor,
                turno: e.turno,
                foto1: ofi ? ofi.foto1 : '',
                foto2: ofi ? ofi.foto2 : ''
            }
        });
    });
}

function clearFilters() {
    ['filter-setor', 'filter-turno', 'filter-oficiante'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    applyFilters();
}

/**
 * Busca de Dados
 */
async function fetchData() {
    const resOficiantes = await apiCall({ action: "listOficiantes" });
    if (resOficiantes.status === "ok") {
        oficiantes = resOficiantes.data;
        renderOficiantes();
        updateOficianteSelect();
    }

    const resEscala = await apiCall({ action: "listEscala" });
    if (resEscala.status === "ok") {
        escala = resEscala.data;
        renderEscalaTable();
        applyFilters(); 
    }
}

/**
 * Oficiante: Cadastro e Edição
 */
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "A guardar...";

    try {
        const id = document.getElementById('oficiante-id').value;
        const f1 = document.getElementById('fotoInput1').files[0];
        const f2 = document.getElementById('fotoInput2').files[0];
        
        const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
        let url1 = f1 ? await uploadParaCloudinary(f1) : (ori ? ori.foto1 : "");
        let url2 = f2 ? await uploadParaCloudinary(f2) : (ori ? ori.foto2 : "");

        const res = await apiCall({
            action: id ? "updateOficiante" : "addOficiante",
            id: id,
            nome: document.getElementById('oficiante-nome').value,
            foto1: url1,
            foto2: url2
        });

        if (res.status === "ok") {
            closeModal('modal-oficiante');
            fetchData();
        } else {
            alert(res.message);
        }
    } catch (err) {
        alert("Erro no processo: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

/**
 * Escala: Cadastro e Edição (Diferenciação ADD/UPDATE corrigida)
 */
document.getElementById('form-escala').onsubmit = async (e) => {
    e.preventDefault();
    const ofiSelect = document.getElementById('escala-oficiante');
    const turno = document.getElementById('escala-turno').value;
    const setor = document.getElementById('escala-setor').value;
    const inputData = document.getElementById('escala-data').value;
    
    // Verificação de ID original e data original para garantir o UPDATE correto no Google Sheets
    const idOrig = document.getElementById('escala-id-original').value;
    const dataOrig = document.getElementById('escala-data-original').value;
    const isEdit = idOrig !== "" && dataOrig !== "";

    let hInicio = document.getElementById('escala-hora-inicio')?.value;
    let hFim = document.getElementById('escala-hora-fim')?.value;
    
    if (!hInicio || setor !== 'RECEPÇÃO') {
        const horários = CONFIG_TURNOS[turno] || { inicio: "07:00", fim: "12:00" };
        hInicio = horários.inicio;
        hFim = horários.fim;
    }

    const payload = {
        action: isEdit ? "updateEscala" : "addEscala",
        data: inputData, 
        id_oficiante: ofiSelect.value,
        nome_oficiante: ofiSelect.options[ofiSelect.selectedIndex].text,
        setor: setor,
        turno: turno,
        hora_inicio: hInicio,
        hora_fim: hFim,
        id_original: idOrig,
        data_original: dataOrig,
        turno_original: document.getElementById('escala-turno-original').value
    };

    const res = await apiCall(payload);
    if (res.status === "ok") { 
        closeModal('modal-escala'); 
        fetchData(); 
    } else {
        alert("Erro ao guardar escala: " + res.message);
    }
};

/**
 * Renderização de Tabelas
 */
function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

    // Ordenação robusta por data (string YYYY-MM-DD)
    const escalaOrdenada = [...escala].sort((a,b) => a.data.localeCompare(b.data));

    tbody.innerHTML = escalaOrdenada.map(e => {
        const parts = e.data.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]); // Cria data local
        
        const isRecepcao = e.setor.toUpperCase() === 'RECEPÇÃO';
        const horarioInfo = isRecepcao ? `<div class="text-[9px] text-slate-500 mt-0.5">${e.hora_inicio} às ${e.hora_fim}</div>` : '';

        return `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-4 text-sm font-medium text-slate-700">
                    <div class="font-bold">${parts[2]}/${parts[1]}/${parts[0]} - ${diasSemana[d.getDay()]}</div>
                </td>
                <td class="p-4 font-bold text-slate-900">${e.nome_oficiante}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                        ${e.setor} - ${e.turno}
                    </span>
                    ${horarioInfo}
                </td>
                <td class="p-4 text-right flex gap-2 justify-end">
                    <button onclick='editEscalaItem(${JSON.stringify(e)})' class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-300 hover:text-red-500 p-2 rounded-lg transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div class="flex -space-x-3">
                <img src="${o.foto1 || ''}" class="w-12 h-12 rounded-full border-2 border-white object-cover bg-slate-100 shadow-sm">
                <img src="${o.foto2 || ''}" class="w-12 h-12 rounded-full border-2 border-white object-cover bg-slate-100 shadow-sm">
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 truncate text-sm">${o.nome}</p>
                <p class="text-[9px] text-slate-400 font-mono">ID: ${o.id}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="editOficiante('${o.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                <button onclick="deleteOficiante('${o.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

/**
 * Funções de Modal e Edição
 */
function editEscalaItem(item) {
    openEscalaModal();
    // Preenchimento dos campos visíveis
    document.getElementById('escala-oficiante').value = item.id_oficiante;
    document.getElementById('escala-data').value = item.data;
    document.getElementById('escala-setor').value = item.setor;
    document.getElementById('escala-turno').value = item.turno;
    
    // Preenchimento dos campos de controlo para o UPDATE
    document.getElementById('escala-id-original').value = item.id_oficiante;
    document.getElementById('escala-data-original').value = item.data;
    document.getElementById('escala-turno-original').value = item.turno;

    // Trigger visual para campos de hora
    document.getElementById('escala-setor').dispatchEvent(new Event('change'));
    if(item.hora_inicio) document.getElementById('escala-hora-inicio').value = item.hora_inicio;
    if(item.hora_fim) document.getElementById('escala-hora-fim').value = item.hora_fim;
    
    // Altera o texto do botão para indicar edição
    const submitBtn = document.querySelector('#form-escala button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Alterar Registo";
}

async function deleteEscalaItem(id, data, turno) {
    if (confirm("Deseja realmente remover este item da escala?")) {
        const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
        if (res.status === "ok") fetchData();
    }
}

async function deleteOficiante(id) {
    if (confirm("Excluir cadastro do oficiante?")) {
        const res = await apiCall({ action: "deleteOficiante", id });
        if (res.status === "ok") fetchData();
    }
}

function editOficiante(id) {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    openOficianteModal();
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
}

/**
 * UI e Helpers
 */
function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${tab}`)?.classList.remove('hidden');
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`tab-${tab}`)?.classList.add('border-blue-600', 'text-blue-600');
    if (tab === 'calendar' && calendar) {
        setTimeout(() => {
            calendar.updateSize();
            calendar.render();
        }, 200);
    }
}

function updateOficianteSelect() {
    const selects = ['escala-oficiante', 'filter-oficiante'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isFilter = id.includes('filter');
        el.innerHTML = (isFilter ? '<option value="">Todos Oficiantes</option>' : '<option value="">Selecione...</option>') + 
            oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    });
}

function openOficianteModal() {
    document.getElementById('form-oficiante').reset();
    document.getElementById('oficiante-id').value = '';
    document.getElementById('modal-oficiante').style.display = 'flex';
}

function openEscalaModal() {
    // Limpeza completa do formulário e dos campos ocultos de controlo
    const form = document.getElementById('form-escala');
    if (form) form.reset();
    
    document.getElementById('escala-id-original').value = '';
    document.getElementById('escala-data-original').value = '';
    document.getElementById('escala-turno-original').value = '';
    
    // Reset visual dos campos de horas (garante que ficam ocultos se não for Recepção)
    document.getElementById('escala-setor').dispatchEvent(new Event('change'));
    
    // Reset do texto do botão para o padrão de inserção
    const submitBtn = document.querySelector('#form-escala button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Adicionar à Escala";
    
    document.getElementById('modal-escala').style.display = 'flex';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showLoading(show) { document.getElementById('loading')?.classList.toggle('hidden', !show); }

/**
 * Exportação em PDF
 */
function generateProfessionalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const agora = new Date();
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    doc.setFontSize(18);
    doc.text("Escala Oficial do Templo", 15, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Relatório extraído em: ${agora.toLocaleDateString('pt-br')} ${agora.getHours()}:${agora.getMinutes()}`, 15, 27);

    const rows = escala.sort((a,b) => a.data.localeCompare(b.data)).map(e => {
        const parts = e.data.split('-');
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        const dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]} (${diasSemana[d.getDay()]})`;
        return [dataFormatada, e.nome_oficiante, e.setor, `${e.turno} (${e.hora_inicio}-${e.hora_fim})` ];
    });

    doc.autoTable({ 
        head: [['Data', 'Oficiante', 'Setor', 'Turno/Horário']], 
        body: rows, 
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8, cellPadding: 3 }
    });
    
    doc.save(`Escala_Templo_${agora.toISOString().split('T')[0]}.pdf`);
}

/**
 * Auth e Credenciais
 */
function handleCredentialResponse(response) {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        currentUser = payload;
        document.getElementById('loginContainer')?.classList.add('hidden');
        document.getElementById('userInfo')?.classList.remove('hidden');
        document.getElementById('userName').innerText = payload.name;
        document.getElementById('userPic').src = payload.picture;
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    } catch (err) {
        console.error("Erro ao processar login:", err);
    }
}
