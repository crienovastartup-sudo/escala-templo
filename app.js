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
 * Funções Utilitárias de Data
 */
function formatarDataLimpa(dataStr) {
    if (!dataStr) return { dataFormatada: "Data Inválida", diaSemana: "N/A", parts: [] };
    const apenasData = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr;
    const parts = apenasData.split('-'); 
    if (parts.length !== 3) return { dataFormatada: apenasData, diaSemana: "N/A", parts };
    
    // Ajuste para evitar problemas de fuso horário ao criar objeto Date
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    
    return {
        dataFormatada: `${parts[2]}/${parts[1]}/${parts[0]}`,
        diaSemana: diasSemana[d.getDay()],
        parts: parts
    };
}

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
            const val = e.target.value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const isRecepcao = val === 'RECEPCAO';
            const hourFields = document.getElementById('escala-horas-container');
            if (hourFields) hourFields.classList.toggle('hidden', !isRecepcao);
        });
    }
    
    // Filtros em tempo real
    ['filter-setor', 'filter-turno', 'filter-oficiante'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyFilters);
    });
}

/**
 * API e Cloudinary
 */
async function apiCall(data) {
    showLoading(true);
    let retries = 5;
    let delay = 1000;
    while (retries > 0) {
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
            const json = await res.json();
            showLoading(false);
            return json;
        } catch (e) {
            retries--;
            if (retries === 0) {
                showLoading(false);
                return { status: "error", message: "Falha na comunicação com o servidor." };
            }
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

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
        return data.secure_url || ""; 
    } catch (error) {
        console.error("Erro Cloudinary:", error);
        throw error;
    }
}

/**
 * FullCalendar
 */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
        locale: 'pt-br',
        height: 'auto',
        timeZone: 'UTC',
        headerToolbar: { 
            left: 'prev,next today', 
            center: 'title', 
            right: 'dayGridMonth,listWeek' 
        },
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            const setor = (ext.setor || "").toUpperCase();
            let colorClass = "card-default";
            
            if (setor.includes("BATISTERIO")) colorClass = "card-batisterio";
            else if (setor.includes("RECEPCAO")) colorClass = "card-recepcao";
            else if (setor.includes("SELAMENTO")) colorClass = "card-selamento";
            
            return { html: `
                <div class="event-card-custom ${colorClass}" style="border-left: 4px solid currentColor; padding: 4px; min-height: 55px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="font-weight: 800; font-size: 11px;">${arg.event.title}</div>
                        <div style="font-size: 9px; font-weight: 700;">${ext.turno}</div>
                    </div>
                    <div class="flex -space-x-2 mt-1 justify-end">
                        ${ext.foto1 ? `<img src="${ext.foto1}" style="width: 22px; height: 22px; border-radius: 99px; border: 1px solid white; object-fit: cover;">` : ''}
                        ${ext.foto2 ? `<img src="${ext.foto2}" style="width: 22px; height: 22px; border-radius: 99px; border: 1px solid white; object-fit: cover;">` : ''}
                    </div>
                </div>
            `};
        }
    });
    calendar.render();
}

function applyFilters() {
    const fSetor = document.getElementById('filter-setor')?.value;
    const fTurno = document.getElementById('filter-turno')?.value;
    const fOfiId = document.getElementById('filter-oficiante')?.value;
    
    if (!calendar) return;
    calendar.removeAllEvents();
    
    const filtrados = escala.filter(item => {
        const mS = !fSetor || item.setor === fSetor;
        const mT = !fTurno || item.turno === fTurno;
        const mO = !fOfiId || String(item.id_oficiante) === String(fOfiId);
        return mS && mT && mO;
    });
    
    filtrados.forEach(e => {
        const ofi = oficiantes.find(o => String(o.id) === String(e.id_oficiante));
        calendar.addEvent({
            title: e.nome_oficiante,
            start: e.data.split('T')[0], 
            allDay: true,
            extendedProps: { 
                setor: e.setor, 
                turno: e.turno, 
                foto1: ofi?.foto1, 
                foto2: ofi?.foto2 
            }
        });
    });
}

async function fetchData() {
    const rO = await apiCall({ action: "listOficiantes" });
    if (rO?.status === "ok") {
        oficiantes = rO.data;
        renderOficiantes();
        updateOficianteSelect();
    }
    const rE = await apiCall({ action: "listEscala" });
    if (rE?.status === "ok") {
        escala = rE.data;
        renderEscalaTable();
        applyFilters(); 
    }
}

/**
 * Funções de UI (EXPOSTAS GLOBALMENTE PARA FUNCIONAMENTO DOS BOTÕES ONCLICK)
 */
window.switchTab = (tab) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${tab}`)?.classList.remove('hidden');
    if (tab === 'calendar' && calendar) setTimeout(() => calendar.updateSize(), 200);
};

window.openEscalaModal = () => {
    const m = document.getElementById('modal-escala');
    const f = document.getElementById('form-escala');
    if (f) f.reset();
    
    ['escala-id-original', 'escala-data-original', 'escala-turno-original'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    document.getElementById('escala-horas-container')?.classList.add('hidden');
    const btn = document.querySelector('#form-escala button[type="submit"]');
    if (btn) btn.innerText = "Adicionar à Escala";
    if (m) m.style.display = 'flex';
};

window.closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
};

window.openOficianteModal = () => {
    const m = document.getElementById('modal-oficiante');
    const f = document.getElementById('form-oficiante');
    if (f) f.reset();
    const idF = document.getElementById('oficiante-id');
    if (idF) idF.value = '';
    if (m) m.style.display = 'flex';
};

window.generateProfessionalPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dataHoralocal = new Date().toLocaleString('pt-BR');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Escala Oficial do Templo", 15, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Relatório extraído em: ${dataHoralocal}`, 15, 28);
    
    const rows = escala.sort((a,b) => a.data.localeCompare(b.data)).map(e => {
        const info = formatarDataLimpa(e.data);
        const horario = (e.hora_inicio && e.hora_fim) ? ` (${e.hora_inicio}-${e.hora_fim})` : "";
        return [
            `${info.dataFormatada} (${info.diaSemana})`,
            e.nome_oficiante,
            e.setor,
            `${e.turno}${horario}`
        ];
    });
    
    doc.autoTable({
        head: [['Data', 'Oficiante', 'Setor', 'Turno/Horário']],
        body: rows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillStyle: '#3b82f6', textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 }
    });
    
    doc.save(`Escala_Templo_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Submissão de Formulários
 */
const fOfi = document.getElementById('form-oficiante');
if (fOfi) {
    fOfi.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const id = document.getElementById('oficiante-id').value;
            const f1 = document.getElementById('fotoInput1').files[0];
            const f2 = document.getElementById('fotoInput2').files[0];
            
            const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
            let u1 = f1 ? await uploadParaCloudinary(f1) : (ori ? ori.foto1 : "");
            let u2 = f2 ? await uploadParaCloudinary(f2) : (ori ? ori.foto2 : "");
            
            const res = await apiCall({
                action: id ? "updateOficiante" : "addOficiante",
                id, 
                nome: document.getElementById('oficiante-nome').value, 
                foto1: u1, 
                foto2: u2
            });
            
            if (res.status === "ok") { 
                window.closeModal('modal-oficiante'); 
                fetchData(); 
            }
        } catch (err) { 
            alert("Erro ao guardar oficiante: " + err.message); 
        }
        btn.disabled = false;
    };
}

const fEsc = document.getElementById('form-escala');
if (fEsc) {
    fEsc.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        
        const ofiSel = document.getElementById('escala-oficiante');
        const turno = document.getElementById('escala-turno').value;
        const setor = document.getElementById('escala-setor').value;
        const idOrig = document.getElementById('escala-id-original').value;
        
        let hI = document.getElementById('escala-hora-inicio')?.value;
        let hF = document.getElementById('escala-hora-fim')?.value;
        
        if (!hI) {
            const h = CONFIG_TURNOS[turno] || { inicio: "07:00", fim: "12:00" };
            hI = h.inicio; 
            hF = h.fim;
        }
        
        const payload = {
            action: idOrig ? "updateEscala" : "addEscala",
            data: document.getElementById('escala-data').value,
            id_oficiante: ofiSel.value,
            nome_oficiante: ofiSel.options[ofiSel.selectedIndex].text,
            setor, 
            turno, 
            hora_inicio: hI, 
            hora_fim: hF,
            id_original: idOrig,
            data_original: document.getElementById('escala-data-original').value,
            turno_original: document.getElementById('escala-turno-original').value
        };

        const res = await apiCall(payload);
        if (res.status === "ok") { 
            window.closeModal('modal-escala'); 
            fetchData(); 
        } else {
            alert("Erro na escala: " + (res.message || "Desconhecido"));
        }
        btn.disabled = false;
    };
}

/**
 * Renderização e Ações de Tabelas e Listas
 */
function renderEscalaTable() {
    const tb = document.getElementById('escala-table-body');
    if (!tb) return;
    
    tb.innerHTML = escala.sort((a,b) => a.data.localeCompare(b.data)).map(e => {
        const info = formatarDataLimpa(e.data);
        return `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="p-4">
                    <div class="font-bold">${info.dataFormatada}</div>
                    <div class="text-xs text-gray-500">${info.diaSemana}</div>
                </td>
                <td class="p-4">${e.nome_oficiante}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100">${e.setor}</span>
                    <div class="text-xs mt-1">${e.turno} ${e.hora_inicio ? `(${e.hora_inicio})` : ''}</div>
                </td>
                <td class="p-4 text-right">
                    <button onclick='window.editEscalaItem(${JSON.stringify(e)})' class="text-blue-500 hover:text-blue-700 font-medium mr-3">Editar</button>
                    <button onclick="window.deleteEscalaItem('${e.id_oficiante}', '${e.data.split('T')[0]}', '${e.turno}')" class="text-red-400 hover:text-red-600 font-medium">Apagar</button>
                </td>
            </tr>`;
    }).join('');
}

window.editEscalaItem = (item) => {
    window.openEscalaModal();
    const d = item.data.split('T')[0];
    
    document.getElementById('escala-oficiante').value = item.id_oficiante;
    document.getElementById('escala-data').value = d;
    document.getElementById('escala-setor').value = item.setor;
    document.getElementById('escala-turno').value = item.turno;
    
    // Campos de controlo para o update
    document.getElementById('escala-id-original').value = item.id_oficiante;
    document.getElementById('escala-data-original').value = d;
    document.getElementById('escala-turno-original').value = item.turno;
    
    // Horas manuais
    if(document.getElementById('escala-hora-inicio')) document.getElementById('escala-hora-inicio').value = item.hora_inicio || '';
    if(document.getElementById('escala-hora-fim')) document.getElementById('escala-hora-fim').value = item.hora_fim || '';
    
    // Trigger para mostrar campos de hora se for recepção
    document.getElementById('escala-setor').dispatchEvent(new Event('change'));
    
    const submitBtn = document.querySelector('#form-escala button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Alterar Registo";
};

window.deleteEscalaItem = async (id, data, turno) => {
    if (confirm("Tem a certeza que deseja remover este item da escala?")) {
        const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
        if (res?.status === "ok") fetchData();
    }
};

window.editOficiante = (id) => {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    window.openOficianteModal();
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
};

window.deleteOficiante = async (id) => {
    if (confirm("Isto apagará o oficiante e todos os seus registos de escala. Continuar?")) {
        const res = await apiCall({ action: "deleteOficiante", id });
        if (res?.status === "ok") fetchData();
    }
};

function renderOficiantes() {
    const c = document.getElementById('oficiantes-list');
    if (!c) return;
    c.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition">
            <div class="relative">
                <img src="${o.foto1 || 'https://via.placeholder.com/40'}" class="w-12 h-12 rounded-full border-2 border-blue-100 object-cover">
            </div>
            <div class="flex-1">
                <p class="font-bold text-gray-800">${o.nome}</p>
                <p class="text-xs text-gray-400">ID: ${o.id}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.editOficiante('${o.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <i data-lucide="edit-2" class="w-4 h-4"></i> Editar
                </button>
                <button onclick="window.deleteOficiante('${o.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateOficianteSelect() {
    ['escala-oficiante', 'filter-oficiante'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isF = id.includes('filter');
        el.innerHTML = (isF ? '<option value="">Todos os Oficiantes</option>' : '<option value="">Selecione um Oficiante...</option>') + 
            oficiantes.sort((a,b) => a.nome.localeCompare(b.nome)).map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    });
}

/**
 * Utilitários de Interface
 */
function showLoading(s) { 
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !s); 
}

window.handleCredentialResponse = (response) => {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        document.getElementById('loginContainer')?.classList.add('hidden');
        document.getElementById('userInfo')?.classList.remove('hidden');
        document.getElementById('userName').innerText = payload.name;
        document.getElementById('userEmail').innerText = payload.email;
        
        // Exibe controlos administrativos
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        currentUser = payload;
    } catch (e) {
        console.error("Erro no login Google:", e);
    }
};
