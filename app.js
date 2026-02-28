/**
 * Configurações Globais e Variáveis de Estado
 * @constant {string} API_URL - Endpoint do Google Apps Script (Web App)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";
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
 * Configuração do FullCalendar
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
            let html = `
                <div class="p-1.5 overflow-hidden">
                    <div class="text-[10px] font-black uppercase opacity-70 leading-none mb-1">${ext.setor}</div>
                    <div class="text-[11px] font-bold truncate">${arg.event.title}</div>
                    <div class="flex -space-x-1 mt-1 opacity-90">
                        ${ext.foto1 ? `<img src="${ext.foto1}" class="w-4 h-4 rounded-full border border-white bg-white object-cover">` : ''}
                        ${ext.foto2 ? `<img src="${ext.foto2}" class="w-4 h-4 rounded-full border border-white bg-white object-cover">` : ''}
                    </div>
                </div>
            `;
            return { html };
        }
    });
    calendar.render();
}

/**
 * Filtros de Visualização (NOVO)
 */
function applyFilters() {
    const setor = document.getElementById('filter-setor').value;
    const turno = document.getElementById('filter-turno').value;
    const oficianteId = document.getElementById('filter-oficiante').value;

    if (!calendar) return;
    calendar.removeAllEvents();
    
    const filtrados = escala.filter(item => {
        const matchSetor = !setor || item.setor === setor;
        const matchTurno = !turno || item.turno === turno;
        const matchOfi = !oficianteId || String(item.id_oficiante) === String(oficianteId);
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
    document.getElementById('filter-setor').value = "";
    document.getElementById('filter-turno').value = "";
    document.getElementById('filter-oficiante').value = "";
    applyFilters();
}

/**
 * Callback de Autenticação do Google
 */
function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    
    currentUser = JSON.parse(jsonPayload);
    
    document.getElementById('loginContainer').classList.add('hidden');
    const info = document.getElementById('userInfo');
    if (info) {
        info.classList.remove('hidden');
        document.getElementById('userName').innerText = currentUser.name;
        document.getElementById('userPic').src = currentUser.picture;
    }
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

function logout() {
    currentUser = null;
    location.reload();
}

/**
 * Chamada Genérica para a API
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
 * Sincronização de Dados
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
 * Upload para Cloudinary (Modo Unsigned)
 */
async function uploadParaCloudinary(file) {
    const cloudName = "dwlrxb6a0"; 
    const unsignedUploadPreset = "ml_default"; 
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", unsignedUploadPreset);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Erro no upload");
        return data.secure_url; 
    } catch (error) {
        console.error("Falha no Cloudinary:", error);
        throw error;
    }
}

/**
 * Submissão do Formulário de Oficiante
 */
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btnSalvar = e.target.querySelector('button[type="submit"]');
    const originalBtnText = btnSalvar ? btnSalvar.innerText : "Salvar";
    
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerText = "Enviando fotos...";
    }

    try {
        const id = document.getElementById('oficiante-id').value;
        const file1 = document.getElementById('fotoInput1').files[0];
        const file2 = document.getElementById('fotoInput2').files[0];
        
        const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
        let url1 = ori ? ori.foto1 : "";
        let url2 = ori ? ori.foto2 : "";

        if (file1) url1 = await uploadParaCloudinary(file1);
        if (file2) url2 = await uploadParaCloudinary(file2);

        const payload = {
            action: id ? "updateOficiante" : "addOficiante",
            id: id,
            nome: document.getElementById('oficiante-nome').value,
            foto1: url1, 
            foto2: url2
        };

        const res = await apiCall(payload);
        if (res.status === "ok") { 
            closeModal('modal-oficiante'); 
            fetchData(); 
            alert("Salvo com sucesso!");
        }
    } catch (err) {
        alert(err.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerText = originalBtnText;
        }
    }
};

/**
 * Submissão do Formulário de Escala (COM TRATAMENTO DE DATA E TURNO)
 */
document.getElementById('form-escala').onsubmit = async (e) => {
    e.preventDefault();
    const ofiSelect = document.getElementById('escala-oficiante');
    const turno = document.getElementById('escala-turno').value;
    
    // Normalização da data para evitar duplicidade por hora
    const rawDate = document.getElementById('escala-data').value;
    const cleanDate = rawDate.split('T')[0]; 

    // Horários automáticos
    const horários = CONFIG_TURNOS[turno] || { inicio: "00:00", fim: "00:00" };

    const payload = {
        action: "addEscala",
        data: cleanDate,
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
 * Renderização de Interface
 */
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-4">
                <div class="relative flex -space-x-4">
                    <img src="${o.foto1 || 'https://via.placeholder.com/150'}" class="w-14 h-14 rounded-full border-2 border-white object-cover shadow-sm bg-slate-50">
                    <img src="${o.foto2 || 'https://via.placeholder.com/150'}" class="w-14 h-14 rounded-full border-2 border-white object-cover shadow-sm bg-slate-50">
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="font-bold text-slate-800 truncate">${o.nome}</p>
                    <p class="text-[10px] text-slate-400 font-mono">ID: ${o.id}</p>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="editOficiante('${o.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteOficiante('${o.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-4 text-sm font-medium text-slate-700">${new Date(e.data + 'T00:00:00').toLocaleDateString('pt-br')}</td>
            <td class="p-4 font-bold text-slate-900">${e.nome_oficiante}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100">${e.setor} - ${e.turno}</span></td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-200 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

/**
 * Exportação em PDF (PROFISSIONAL)
 */
function generateProfessionalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const ordemTurnos = { "PRIMEIRO": 1, "SEGUNDO": 2, "TERCEIRO": 3 };

    const escalaOrdenada = [...escala].sort((a, b) => {
        const dateA = new Date(a.data);
        const dateB = new Date(b.data);
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
        return (ordemTurnos[a.turno] || 0) - (ordemTurnos[b.turno] || 0);
    });

    doc.setFontSize(18);
    doc.text("Escala Oficial de Oficiantes", 15, 20);
    
    const rows = escalaOrdenada.map(e => {
        const dataObj = new Date(e.data + 'T00:00:00'); 
        const diaNome = diasSemana[dataObj.getDay()];
        const h = CONFIG_TURNOS[e.turno] || { inicio: "-", fim: "-" };
        return [`${dataObj.toLocaleDateString('pt-br')} (${diaNome})`, e.nome_oficiante, e.setor, `${e.turno} (${h.inicio}-${h.fim})` ];
    });

    doc.autoTable({ head: [['Data (Dia)', 'Oficiante', 'Setor', 'Turno / Horário']], body: rows, startY: 30, theme: 'grid' });
    doc.save(`escala_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Utilitários e Navegação
 */
function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(`sec-${tab}`);
    if (sec) { sec.classList.remove('hidden'); sec.classList.add('block'); }
    
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    const tabBtn = document.getElementById(`tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('border-blue-600', 'text-blue-600');
    if (tab === 'calendar' && calendar) setTimeout(() => calendar.updateSize(), 50);
}

function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}

function openOficianteModal() {
    document.getElementById('form-oficiante').reset();
    document.getElementById('oficiante-id').value = '';
    document.getElementById('oficiante-modal-title').innerText = 'Novo Oficiante';
    document.getElementById('modal-oficiante').style.display = 'flex';
}

function openEscalaModal() {
    document.getElementById('form-escala').reset();
    document.getElementById('modal-escala').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function updateOficianteSelect() {
    const sScale = document.getElementById('escala-oficiante');
    const sFilter = document.getElementById('filter-oficiante');
    const options = '<option value="">Selecione...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    
    if (sScale) sScale.innerHTML = options;
    if (sFilter) sFilter.innerHTML = '<option value="">Todos os Oficiantes</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

async function deleteEscalaItem(id, data, turno) {
    if (!confirm("Remover este item da escala?")) return;
    const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
    if (res.status === "ok") fetchData();
}

async function deleteOficiante(id) {
    if (!confirm("Excluir cadastro do oficiante?")) return;
    const res = await apiCall({ action: "deleteOficiante", id: id });
    if (res.status === "ok") fetchData();
}

function editOficiante(id) {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    openOficianteModal();
    document.getElementById('oficiante-modal-title').innerText = 'Editar Cadastro';
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
}
