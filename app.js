/**
 * Script de Controle do Sistema de Escalas
 * Gerencia API (App Script), Calendário e Interface Completa
 */

// SUBSTITUA PELA SUA URL DO GOOGLE APP SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

let oficiantes = [];
let escala = [];
let calendar;
let currentUser = null;

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initCalendar();
    fetchData();
    setupFormEvents();
});

// Inicializa o FullCalendar
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
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
            return {
                html: `
                    <div class="p-1">
                        <div class="text-[9px] uppercase font-bold opacity-60">${ext.setor}</div>
                        <div class="text-[10px] truncate font-bold">${arg.event.title}</div>
                        <div class="flex -space-x-1 mt-0.5">
                            ${ext.foto1 ? `<img src="${ext.foto1}" class="w-4 h-4 rounded-full border border-white">` : ''}
                            ${ext.foto2 ? `<img src="${ext.foto2}" class="w-4 h-4 rounded-full border border-white">` : ''}
                        </div>
                    </div>
                `
            };
        },
        eventClassNames: function(arg) {
            const setor = arg.event.extendedProps.setor;
            const map = { 'Batisterio': 'bg-batisterio', 'Recepção': 'bg-recepcao', 'Selamento': 'bg-selamento' };
            return [map[setor] || ''];
        }
    });
    calendar.render();
}

// Chamar App Script
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
        return { status: "error" };
    } finally {
        showLoading(false);
    }
}

// Buscar dados e atualizar UI
async function fetchData() {
    const resOfi = await apiCall({ action: "listOficiantes" });
    if (resOfi.status === "ok") {
        oficiantes = resOfi.data;
        renderOficiantes();
        updateOficianteDropdown();
    }

    const resEsc = await apiCall({ action: "listEscala" });
    if (resEsc.status === "ok") {
        escala = resEsc.data;
        renderEscalaTable();
        updateCalendarEvents();
    }
}

// Renderizar Oficiantes (Cards)
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-4 rounded-xl border flex items-center gap-4 shadow-sm">
            <div class="flex -space-x-3">
                <img src="${o.foto1 || ''}" class="w-10 h-10 rounded-full border-2 border-white bg-slate-100 object-cover">
                <img src="${o.foto2 || ''}" class="w-10 h-10 rounded-full border-2 border-white bg-slate-100 object-cover">
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold truncate">${o.nome}</p>
            </div>
            <button onclick="deleteOficiante('${o.id}')" class="text-red-400 hover:text-red-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    lucide.createIcons();
}

// Renderizar Tabela de Escala
function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b text-sm">
            <td class="p-4">${new Date(e.data).toLocaleDateString('pt-br')}</td>
            <td class="p-4 font-bold">${e.nome_oficiante}</td>
            <td class="p-4">${e.setor} (${e.turno})</td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-400 hover:text-red-500">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

// Atualizar Eventos no Calendário
function updateCalendarEvents() {
    calendar.removeAllEvents();
    escala.forEach(e => {
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

// Dropdown de Oficiantes no Modal
function updateOficianteDropdown() {
    const select = document.getElementById('escala-oficiante');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

// Configurar Envios de Formulário
function setupFormEvents() {
    document.getElementById('form-oficiante').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            action: "addOficiante",
            nome: document.getElementById('oficiante-nome').value,
            foto1: document.getElementById('oficiante-url1').value,
            foto2: document.getElementById('oficiante-url2').value
        };
        const res = await apiCall(payload);
        if (res.status === "ok") { closeModal('modal-oficiante'); fetchData(); }
    };

    document.getElementById('form-escala').onsubmit = async (e) => {
        e.preventDefault();
        const ofiSelect = document.getElementById('escala-oficiante');
        const payload = {
            action: "addEscala",
            data: document.getElementById('escala-data').value,
            id_oficiante: ofiSelect.value,
            nome_oficiante: ofiSelect.options[ofiSelect.selectedIndex].text,
            setor: document.getElementById('escala-setor').value,
            turno: document.getElementById('escala-turno').value
        };
        const res = await apiCall(payload);
        if (res.status === "ok") { closeModal('modal-escala'); fetchData(); }
    };
}

// Deletar
async function deleteOficiante(id) {
    if (!confirm("Excluir este oficiante?")) return;
    const res = await apiCall({ action: "deleteOficiante", id: id });
    if (res.status === "ok") fetchData();
}

async function deleteEscalaItem(id, data, turno) {
    if (!confirm("Remover da escala?")) return;
    const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
    if (res.status === "ok") fetchData();
}

// UI Helpers
function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${tab}`).classList.remove('hidden');
    document.querySelectorAll('main button').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`tab-${tab}`).classList.add('border-blue-600', 'text-blue-600');
    if(tab === 'calendar') calendar.updateSize();
}

function openOficianteModal() { document.getElementById('modal-oficiante').style.display = 'flex'; }
function openEscalaModal() { document.getElementById('modal-escala').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Auth Google
function handleCredentialResponse(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    currentUser = payload;
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userName').innerText = payload.name;
    document.getElementById('userPic').src = payload.picture;
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

function logout() { location.reload(); }

// PDF
function generateProfessionalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text(`Escala Oficial - ${calendar.view.title}`, 15, 20);
    const rows = escala.map(e => [new Date(e.data).toLocaleDateString('pt-br'), e.nome_oficiante, e.setor, e.turno]);
    doc.autoTable({ startY: 30, head: [['Data', 'Oficiante', 'Setor', 'Turno']], body: rows });
    doc.save('escala.pdf');
}
