/**
 * @fileoverview Sistema de Gestão de Escalas - EscalaOficial
 * @version 2.5.0
 * @description Implementação de Limpeza de Cache de Login e Forçar Janela de Seleção.
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
 * Callback de Autenticação do Google
 * Modificado para forçar a limpeza de estados anteriores.
 */
window.handleCredentialResponse = (response) => {
    try {
        const responsePayload = decodeJwtResponse(response.credential);
        console.log("Utilizador autenticado:", responsePayload.email);
        
        currentUser = responsePayload;
        
        // Atualiza a interface para estado "Logado"
        const loginContainer = document.getElementById('loginContainer');
        const info = document.getElementById('userInfo');
        
        if (loginContainer) loginContainer.classList.add('hidden');
        if (info) {
            info.classList.remove('hidden');
            document.getElementById('userName').innerText = currentUser.name;
            document.getElementById('userPic').src = currentUser.picture;
        }

        // Mostra botões e abas exclusivas para admin
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        
        // Persistência temporária apenas para a aba aberta
        sessionStorage.setItem('isLoggedIn', 'true');

    } catch (error) {
        console.error("Erro no processamento do Login:", error);
        alert("Falha na autenticação. Tente novamente em Janela Incógnita.");
    }
};

/**
 * FUNÇÃO DE LOGOUT: Limpa cache e força nova janela de login
 */
window.logout = () => {
    if (confirm("Deseja encerrar a sessão? Na próxima vez, será solicitada a escolha da conta.")) {
        // 1. Limpa variáveis de estado
        currentUser = null;
        sessionStorage.clear();
        
        // 2. Desativa a seleção automática do Google para a próxima visita
        if (typeof google !== 'undefined') {
            google.accounts.id.disableAutoSelect();
            // Revogar o token para garantir que o cache do navegador não autologue
            google.accounts.id.revoke(localStorage.getItem('google_user_email'), done => {
                console.log('Sessão revogada');
                location.reload();
            });
        }
        
        // 3. Recarrega a página para resetar o DOM
        setTimeout(() => location.reload(), 500);
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

function updateCalendar() {
    if (!calendar) return;
    calendar.removeAllEvents();
    escala.forEach(e => {
        const ofi = oficiantes.find(o => String(o.id) === String(e.id_oficiante));
        calendar.addEvent({
            title: e.nome_oficiante,
            start: e.data,
            allDay: true,
            extendedProps: {
                setor: e.setor,
                foto1: ofi ? ofi.foto1 : '',
                foto2: ofi ? ofi.foto2 : ''
            }
        });
    });
}

/**
 * Cloudinary Upload
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
        if (!response.ok) throw new Error(data.error?.message || "Erro no Cloudinary");
        return data.secure_url;
    } catch (error) {
        console.error("Falha Cloudinary:", error);
        throw error;
    }
}

/**
 * Formulário de Oficiante
 */
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btnSalvar = e.target.querySelector('button[type="submit"]');
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.innerText = "A enviar..."; }

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
            e.target.reset();
        } else {
            alert("Erro: " + res.message);
        }
    } catch (err) {
        alert(err.message);
    } finally {
        if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.innerText = "Salvar Cadastro"; }
    }
};

/**
 * Formulário de Escala
 */
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
    } else {
        alert(res.message);
    }
};

/**
 * UI e Renderização
 */
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex items-center gap-4">
                <div class="relative flex -space-x-4">
                    <img src="${o.foto1 || 'https://via.placeholder.com/150'}" class="w-14 h-14 rounded-full border-2 border-white object-cover bg-slate-50">
                    <img src="${o.foto2 || 'https://via.placeholder.com/150'}" class="w-14 h-14 rounded-full border-2 border-white object-cover bg-slate-50">
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="font-bold text-slate-800 truncate">${o.nome}</p>
                    <p class="text-[10px] text-slate-400">ID: ${o.id}</p>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="editOficiante('${o.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteOficiante('${o.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-4 text-sm font-medium text-slate-700">${new Date(e.data).toLocaleDateString('pt-br')}</td>
            <td class="p-4 font-bold text-slate-900">${e.nome_oficiante}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100">${e.setor}</span></td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-300 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function switchTab(tab) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(`sec-${tab}`);
    if (sec) sec.classList.remove('hidden');
    
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
    select.innerHTML = '<option value="">Selecione...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

window.deleteEscalaItem = async (id, data, turno) => {
    if (!confirm("Remover este item da escala?")) return;
    const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
    if (res.status === "ok") fetchData();
};

window.deleteOficiante = async (id) => {
    if (!confirm("Excluir cadastro do oficiante?")) return;
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
    doc.text("Escala de Oficiantes", 15, 15);
    const rows = escala.map(e => [new Date(e.data).toLocaleDateString('pt-br'), e.nome_oficiante, e.setor, e.turno]);
    doc.autoTable({ head: [['Data', 'Nome', 'Setor', 'Turno']], body: rows, startY: 20 });
    doc.save("escala.pdf");
};
