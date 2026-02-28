/**
 * @fileoverview Sistema de Gestão de Escalas - EscalaOficial
 * @version 2.6.0
 * @description Refatoração estética completa e correção de parse de datas.
 */

const API_URL = "https://script.google.com/macros/s/AKfycbz5n2Y8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

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
};

/**
 * CORREÇÃO DE DATA: Remove horas indesejadas que causam bugs no calendário (ex: imagem 8fa434)
 * @param {string} dateStr 
 */
function cleanDate(dateStr) {
    if (!dateStr) return null;
    // Se a data vier como "2026/03/02 21:00:00", pegamos apenas "2026-03-02"
    const simpleDate = String(dateStr).split(' ')[0].replace(/\//g, '-');
    return simpleDate;
}

/**
 * Callback de Autenticação do Google
 */
window.handleCredentialResponse = (response) => {
    try {
        const responsePayload = decodeJwtResponse(response.credential);
        currentUser = responsePayload;
        
        const loginContainer = document.getElementById('loginContainer');
        const info = document.getElementById('userInfo');
        
        if (loginContainer) loginContainer.classList.add('hidden');
        if (info) {
            info.classList.remove('hidden');
            document.getElementById('userName').innerText = currentUser.name;
            document.getElementById('userPic').src = currentUser.picture;
        }

        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        sessionStorage.setItem('isLoggedIn', 'true');

    } catch (error) {
        console.error("Erro no Login:", error);
    }
};

window.logout = () => {
    if (confirm("Deseja encerrar a sessão?")) {
        currentUser = null;
        sessionStorage.clear();
        if (typeof google !== 'undefined') {
            google.accounts.id.disableAutoSelect();
        }
        location.reload();
    }
};

function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

async function apiCall(data) {
    showLoading(true);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        return { status: "error", message: "Falha na comunicação." };
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

/**
 * Configuração do FullCalendar - Design Refinado
 */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: 'auto',
        fixedWeekCount: false,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: ''
        },
        // Customização radical para evitar os blocos azuis "horrorosos"
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            const setorClass = ext.setor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            let html = `
                <div class="event-minimal-card border-l-4 bg-white shadow-sm ring-1 ring-slate-200 rounded-r-md my-0.5 mx-1 p-1.5 transition-all hover:shadow-md">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">${ext.setor}</span>
                        <span class="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 rounded">${ext.turno}</span>
                    </div>
                    <div class="text-[11px] font-bold text-slate-800 truncate mb-1">${arg.event.title}</div>
                    <div class="flex -space-x-1.5 items-center">
                        ${ext.foto1 ? `<img src="${ext.foto1}" class="w-4 h-4 rounded-full border border-white bg-slate-100 object-cover ring-1 ring-slate-100">` : ''}
                        ${ext.foto2 ? `<img src="${ext.foto2}" class="w-4 h-4 rounded-full border border-white bg-slate-100 object-cover ring-1 ring-slate-100">` : ''}
                    </div>
                </div>
            `;
            return { html };
        }
    });
    calendar.render();
}

function updateCalendar() {
    if (!calendar) return;
    calendar.removeAllEvents();
    escala.forEach(e => {
        const ofi = oficiantes.find(o => String(o.id) === String(e.id_oficiante));
        calendar.addEvent({
            title: e.nome_oficiante,
            start: cleanDate(e.data), // Usa a data limpa aqui
            allDay: true,
            extendedProps: {
                setor: e.setor,
                turno: e.turno || 'Turno',
                foto1: ofi ? ofi.foto1 : '',
                foto2: ofi ? ofi.foto2 : ''
            }
        });
    });
}

/**
 * Restante da lógica de CRUD mantida e otimizada
 */
async function uploadParaCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ml_default");

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/dwlrxb6a0/image/upload`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        throw error;
    }
}

document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btnSalvar = e.target.querySelector('button[type="submit"]');
    if (btnSalvar) btnSalvar.disabled = true;

    try {
        const id = document.getElementById('oficiante-id').value;
        const file1 = document.getElementById('fotoInput1').files[0];
        const file2 = document.getElementById('fotoInput2').files[0];
        
        const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
        let url1 = file1 ? await uploadParaCloudinary(file1) : (ori ? ori.foto1 : "");
        let url2 = file2 ? await uploadParaCloudinary(file2) : (ori ? ori.foto2 : "");

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
        }
    } catch (err) {
        alert("Erro no upload.");
    } finally {
        if (btnSalvar) btnSalvar.disabled = false;
    }
};

document.getElementById('form-escala').onsubmit = async (e) => {
    e.preventDefault();
    const ofiSelect = document.getElementById('escala-oficiante');
    const res = await apiCall({
        action: "addEscala",
        data: document.getElementById('escala-data').value,
        id_oficiante: ofiSelect.value,
        nome_oficiante: ofiSelect.options[ofiSelect.selectedIndex].text,
        setor: document.getElementById('escala-setor').value,
        turno: document.getElementById('escala-turno').value
    });
    if (res.status === "ok") { 
        closeModal('modal-escala'); 
        fetchData(); 
    }
};

function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="relative flex -space-x-3">
                <img src="${o.foto1 || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-full border-2 border-white object-cover bg-slate-50 ring-1 ring-slate-100">
                <img src="${o.foto2 || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-full border-2 border-white object-cover bg-slate-50 ring-1 ring-slate-100">
            </div>
            <div class="flex-1 overflow-hidden">
                <p class="font-bold text-slate-800 text-sm truncate">${o.nome}</p>
                <p class="text-[9px] text-slate-400 font-mono">ID: ${o.id}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="editOficiante('${o.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                <button onclick="deleteOficiante('${o.id}')" class="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
            <td class="p-4 text-xs font-medium text-slate-500">${new Date(cleanDate(e.data)).toLocaleDateString('pt-br')}</td>
            <td class="p-4 font-bold text-slate-800 text-sm">${e.nome_oficiante}</td>
            <td class="p-4"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100">${e.setor}</span></td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-300 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(`sec-${tab}`);
    if (sec) sec.classList.remove('hidden');
    
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600', 'bg-blue-50/50');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    const tabBtn = document.getElementById(`tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('border-blue-600', 'text-blue-600', 'bg-blue-50/50');
    
    if (tab === 'calendar' && calendar) setTimeout(() => calendar.updateSize(), 50);
}

function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
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

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function updateOficianteSelect() {
    const select = document.getElementById('escala-oficiante');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um oficiante...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

window.deleteEscalaItem = async (id, data, turno) => {
    if (!confirm("Remover este item?")) return;
    const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
    if (res.status === "ok") fetchData();
};

window.deleteOficiante = async (id) => {
    if (!confirm("Excluir cadastro?")) return;
    const res = await apiCall({ action: "deleteOficiante", id: id });
    if (res.status === "ok") fetchData();
};

window.editOficiante = (id) => {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    openOficianteModal();
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
};

window.generateProfessionalPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Escala Oficial de Oficiantes", 15, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 15, 28);
    
    const rows = escala.map(e => [
        new Date(cleanDate(e.data)).toLocaleDateString('pt-br'), 
        e.nome_oficiante, 
        e.setor, 
        e.turno
    ]);
    
    doc.autoTable({ 
        head: [['Data', 'Nome', 'Setor', 'Turno']], 
        body: rows, 
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save("escala_profissional.pdf");
};
