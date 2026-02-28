const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

let oficiantes = [];
let escala = [];
let calendar;
let currentUser = null;

window.onload = () => {
    lucide.createIcons();
    initCalendar();
    fetchData();
};

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
            let html = `
                <div class="p-1.5 overflow-hidden">
                    <div class="text-[10px] font-black uppercase opacity-70 leading-none mb-1">${ext.setor}</div>
                    <div class="text-[11px] font-bold truncate">${arg.event.title}</div>
                    <div class="flex -space-x-1 mt-1 opacity-90">
                        ${ext.foto1 ? `<img src="${ext.foto1}" class="w-4 h-4 rounded-full border border-white bg-white">` : ''}
                        ${ext.foto2 ? `<img src="${ext.foto2}" class="w-4 h-4 rounded-full border border-white bg-white">` : ''}
                    </div>
                </div>
            `;
            return { html };
        },
        eventClassNames: function(arg) {
            const setor = arg.event.extendedProps.setor;
            if (setor === 'Batisterio') return ['bg-batisterio'];
            if (setor === 'Recepção') return ['bg-recepcao'];
            if (setor === 'Selamento') return ['bg-selamento'];
            return [];
        }
    });
    calendar.render();
}

// --- Autenticação ---
function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    
    const user = JSON.parse(jsonPayload);
    currentUser = user;
    
    document.getElementById('loginContainer').classList.add('hidden');
    const info = document.getElementById('userInfo');
    info.classList.remove('hidden');
    document.getElementById('userName').innerText = user.name;
    document.getElementById('userPic').src = user.picture;
    
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

function logout() {
    currentUser = null;
    location.reload();
}

// --- API Communications ---
async function apiCall(data) {
    showLoading(true);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error("Erro API:", e);
        return { status: "error", message: "Verifique se o Apps Script está publicado como 'Qualquer Pessoa'." };
    } finally {
        showLoading(false);
    }
}

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
        updateCalendar();
    }
}

// --- PDF Organizado ---
function generateProfessionalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const monthTitle = calendar.view.title;
    
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(`Escala de Oficiantes - ${monthTitle}`, 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 15, 27);

    // Filtrar escala apenas do mês atual exibido no calendário
    const currentMonth = calendar.getDate().getMonth();
    const currentYear = calendar.getDate().getFullYear();
    
    const filteredData = escala
        .filter(e => {
            const d = new Date(e.data);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .sort((a, b) => new Date(a.data) - new Date(b.data));

    const tableRows = filteredData.map(e => [
        new Date(e.data).toLocaleDateString('pt-br'),
        e.nome_oficiante,
        e.setor,
        e.turno
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Data', 'Oficiante', 'Setor', 'Turno']],
        body: tableRows,
        headStyles: { fillColor: [59, 130, 246] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 15, right: 15 }
    });

    doc.save(`Escala_Oficiantes_${monthTitle.replace(' ', '_')}.pdf`);
}

// --- Renderers ---
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition group">
            <div class="flex items-center gap-4">
                <div class="relative flex -space-x-4">
                    <img src="${o.foto1 || 'https://via.placeholder.com/150'}" class="w-14 h-14 rounded-full border-2 border-white object-cover shadow-sm bg-slate-100">
                    <img src="${o.foto2 || 'https://via.placeholder.com/150'}" class="w-14 h-14 rounded-full border-2 border-white object-cover shadow-sm bg-slate-100">
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="font-bold text-slate-800 truncate">${o.nome}</p>
                    <p class="text-[10px] text-slate-400 font-mono">#${o.id}</p>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="editOficiante('${o.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                         <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteOficiante('${o.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                         <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b hover:bg-blue-50/30 transition">
            <td class="p-4 text-sm font-medium text-slate-700">${new Date(e.data).toLocaleDateString('pt-br')}</td>
            <td class="p-4">
                <span class="text-sm font-bold text-slate-900">${e.nome_oficiante}</span>
            </td>
            <td class="p-4">
                <div class="flex items-center gap-2">
                     <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase ${getSetorClass(e.setor)}">${e.setor}</span>
                     <span class="text-xs text-slate-500 font-medium">${e.turno}</span>
                </div>
            </td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="p-2 text-slate-300 hover:text-red-500 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function updateCalendar() {
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

function getSetorClass(setor) {
    if (setor === 'Batistério') return 'bg-batisterio';
    if (setor === 'Recepção') return 'bg-recepcao';
    if (setor === 'Selamento') return 'bg-selamento';
    return 'bg-slate-100';
}

function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${tab}`).classList.remove('hidden');
    
    document.querySelectorAll('main > div button').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`tab-${tab}`).classList.add('border-blue-600', 'text-blue-600');
    if(tab === 'calendar') calendar.updateSize();
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
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
    const select = document.getElementById('escala-oficiante');
    select.innerHTML = '<option value="">Selecione um oficiante...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

// --- Form Handlers ---
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('oficiante-id').value;
    const payload = {
        action: id ? "updateOficiante" : "addOficiante",
        id: id,
        nome: document.getElementById('oficiante-nome').value,
        foto1: document.getElementById('oficiante-url1').value,
        foto2: document.getElementById('oficiante-url2').value
    };
    const res = await apiCall(payload);
    if (res.status === "ok") { closeModal('modal-oficiante'); fetchData(); }
    else alert(res.message);
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
    else alert(res.message);
};

async function deleteEscalaItem(id, data, turno) {
    if (!confirm("Remover este oficiante deste dia?")) return;
    const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
    if (res.status === "ok") fetchData();
}

async function deleteOficiante(id) {
    if (!confirm("Excluir cadastro do oficiante permanentemente?")) return;
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
    document.getElementById('oficiante-url1').value = o.foto1;
    document.getElementById('oficiante-url2').value = o.foto2;
}

