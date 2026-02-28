/**
 * Configurações Globais e Variáveis de Estado
 */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";
const CLOUD_NAME = "dwlrxb6a0";
const UPLOAD_PRESET = "ml_default";

const CONFIG_TURNOS = {
    "PRIMEIRO": { inicio: "07:00", fim: "12:00" },
    "SEGUNDO":  { inicio: "12:00", fim: "17:00" },
    "TERCEIRO": { inicio: "17:00", fim: "21:00" }
};

let oficiantes = []; // Lista de objetos dos oficiantes cadastrados
let escala = [];      // Lista de registros de agendamento na escala
let calendar;        // Instância global do FullCalendar
let currentUser = null; // Armazena dados do perfil logado via Google

/**
 * Inicialização do Sistema
 */
window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCalendar();
    fetchData();
};

/**
 * Chamada Genérica para a API (Google Apps Script)
 * Centraliza o fetch e o controle do overlay de carregamento.
 */
async function apiCall(data) {
    showLoading(true);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error("Erro na API:", e);
        return { status: "error", message: "Falha na comunicação com o servidor." };
    } finally {
        showLoading(false);
    }
}

/**
 * Upload de Imagens para o Cloudinary (Modo Unsigned)
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
 * Configuração do FullCalendar com Renderização de Cards Customizados
 */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            
            // Normalização para cores por setor via CSS
            const setorNorm = (ext.setor || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let colorClass = "card-default";
            
            if (setorNorm.includes("batisterio")) colorClass = "card-batisterio";
            else if (setorNorm.includes("recepcao")) colorClass = "card-recepcao";
            else if (setorNorm.includes("selamento")) colorClass = "card-selamento";

            // Correção de Contraste: Forçando cores escuras no texto para visibilidade
            let html = `
                <div class="event-card-custom ${colorClass}" style="color: #1e293b; border-left: 4px solid currentColor;">
                    <div class="flex flex-col h-full justify-between p-1">
                        <div>
                            <span class="card-title truncate" style="display: block; font-weight: 800; font-size: 11px; line-height: 1.1; color: #0f172a;">
                                ${arg.event.title}
                            </span>
                            <span class="card-subtitle" style="display: block; font-size: 9px; opacity: 0.8; font-weight: 600; color: #334155;">
                                ${ext.turno} - ${ext.setor}
                            </span>
                        </div>
                        <div class="flex -space-x-2 mt-1 self-end">
                            ${ext.foto1 ? `<img src="${ext.foto1}" class="w-5 h-5 rounded-full border border-white object-cover shadow-sm">` : ''}
                            ${ext.foto2 ? `<img src="${ext.foto2}" class="w-5 h-5 rounded-full border border-white object-cover shadow-sm">` : ''}
                        </div>
                    </div>
                </div>
            `;
            return { html };
        }
    });
    calendar.render();
}

/**
 * Filtros de Visualização e Sincronização com o Calendário
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
 * Busca de Dados Iniciais
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
 * Submissão de Oficiante (Cadastro/Edição com Cloudinary)
 */
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Enviando arquivos...";

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
            e.target.reset();
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
 * Submissão de Nova Escala
 */
document.getElementById('form-escala').onsubmit = async (e) => {
    e.preventDefault();
    const ofiSelect = document.getElementById('escala-oficiante');
    const turno = document.getElementById('escala-turno').value;
    const horários = CONFIG_TURNOS[turno] || { inicio: "00:00", fim: "00:00" };

    const payload = {
        action: "addEscala",
        data: document.getElementById('escala-data').value.split('T')[0], // Garante data limpa
        id_oficiante: ofiSelect.value,
        nome_oficiante: ofiSelect.options[ofiSelect.selectedIndex].text,
        setor: document.getElementById('escala-setor').value,
        turno: turno,
        hora_inicio: horários.inicio,
        hora_fim: horários.fim
    };

    const res = await apiCall(payload);
    if (res.status === "ok") { 
        closeModal('modal-escala'); 
        fetchData(); 
    } else {
        alert(res.message);
    }
};

/**
 * Renderização de UI (Listas e Tabelas)
 */
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div class="flex -space-x-3">
                <img src="${o.foto1 || ''}" class="w-10 h-10 rounded-full border-2 border-white object-cover bg-slate-100 shadow-sm">
                <img src="${o.foto2 || ''}" class="w-10 h-10 rounded-full border-2 border-white object-cover bg-slate-100 shadow-sm">
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 truncate text-sm">${o.nome}</p>
                <p class="text-[9px] text-slate-400 font-mono">ID: ${o.id}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="editOficiante('${o.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                <button onclick="deleteOficiante('${o.id}')" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    tbody.innerHTML = escala.map(e => {
        const d = new Date(e.data + 'T00:00:00');
        return `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-4 text-sm font-medium text-slate-700">
                    ${d.toLocaleDateString('pt-br')} <span class="text-[10px] text-slate-400">(${diasSemana[d.getDay()]})</span>
                </td>
                <td class="p-4 font-bold text-slate-900">${e.nome_oficiante}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                        ${e.setor} - ${e.turno}
                    </span>
                </td>
                <td class="p-4 text-right">
                    <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-300 hover:text-red-500 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

/**
 * Helpers de UI e Modais
 */
function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${tab}`)?.classList.remove('hidden');
    
    // Atualiza estado visual dos botões de tab
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`tab-${tab}`)?.classList.add('border-blue-600', 'text-blue-600');

    if (tab === 'calendar' && calendar) setTimeout(() => calendar.updateSize(), 50);
}

function updateOficianteSelect() {
    const selects = ['escala-oficiante', 'filter-oficiante'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isFilter = id.includes('filter');
        el.innerHTML = (isFilter ? '<option value="">Todos os Oficiantes</option>' : '<option value="">Selecione...</option>') + 
            oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    });
}

function openOficianteModal() {
    document.getElementById('form-oficiante').reset();
    document.getElementById('oficiante-id').value = '';
    document.getElementById('modal-oficiante').style.display = 'flex';
}

function openEscalaModal() {
    document.getElementById('form-escala').reset();
    document.getElementById('modal-escala').style.display = 'flex';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showLoading(show) { document.getElementById('loading')?.classList.toggle('hidden', !show); }

/**
 * Operações de Exclusão e Edição
 */
async function deleteEscalaItem(id, data, turno) {
    if (confirm("Remover este item da escala?")) {
        const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
        if (res.status === "ok") fetchData();
    }
}

async function deleteOficiante(id) {
    if (confirm("Excluir cadastro do oficiante? Isso não removerá escalas antigas.")) {
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
 * Exportação em PDF Profissional
 */
function generateProfessionalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const agora = new Date();
    
    doc.setFontSize(18);
    doc.text("Relatório de Escala - Templo", 15, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${agora.toLocaleString('pt-br')}`, 15, 27);

    const rows = escala.sort((a,b) => new Date(a.data) - new Date(b.data)).map(e => {
        const d = new Date(e.data + 'T00:00:00'); 
        return [
            `${d.toLocaleDateString('pt-br')} (${diasSemana[d.getDay()]})`,
            e.nome_oficiante,
            e.setor,
            e.turno
        ];
    });

    doc.autoTable({ 
        head: [['Data e Dia', 'Oficiante', 'Setor', 'Turno']], 
        body: rows, 
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 }
    });
    
    doc.save(`escala_templo_${agora.toISOString().split('T')[0]}.pdf`);
}

/**
 * Callback de Autenticação Google OAuth
 */
function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    currentUser = JSON.parse(jsonPayload);
    
    document.getElementById('loginContainer')?.classList.add('hidden');
    const info = document.getElementById('userInfo');
    if (info) {
        info.classList.remove('hidden');
        document.getElementById('userName').innerText = currentUser.name;
        document.getElementById('userPic').src = currentUser.picture;
    }
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}
