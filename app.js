/**
 * @fileoverview Sistema de Gestão de Escalas - EscalaOficial
 * @version 2.3.0
 * @description Ajuste de layout para cards compactos e fotos visíveis no calendário.
 */

const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dwlrxb6a0/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "ml_default"; 

let oficiantes = []; 
let escala = [];      
let calendar = null;  
let currentUser = null;

window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCalendar();
    fetchData();
};

async function apiCall(data) {
    showLoading(true);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        return { status: "error", message: "Falha na comunicação com o servidor." };
    } finally {
        showLoading(false);
    }
}

async function fetchData() {
    const resOficiantes = await apiCall({ action: "listOficiantes" });
    if (resOficiantes && resOficiantes.status === "ok") {
        oficiantes = resOficiantes.data;
        renderOficiantes();
        updateOficianteSelect();
    }

    const resEscala = await apiCall({ action: "listEscala" });
    if (resEscala && resEscala.status === "ok") {
        escala = resEscala.data;
        renderEscalaTable();
        updateCalendar(); 
    }
}

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: 'auto',
        dayMaxEvents: 3, // Limita eventos por dia para evitar esticar a célula
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            const bgClass = getSetorColorClass(ext.setor);
            
            // Layout ultra-compacto focado na foto e no nome
            let html = `
                <div class="flex flex-col w-full rounded-md border-l-4 shadow-sm mb-1 ${bgClass} p-1 overflow-hidden" style="max-height: 45px;">
                    <div class="flex items-center gap-2">
                        <div class="flex -space-x-2 shrink-0">
                            ${ext.foto1 ? `<img src="${ext.foto1}" class="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm">` : `<div class="w-7 h-7 rounded-full bg-slate-200 border-2 border-white"></div>`}
                            ${ext.foto2 ? `<img src="${ext.foto2}" class="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm">` : ''}
                        </div>
                        <div class="flex flex-col min-w-0 leading-tight">
                            <span class="text-[7px] font-black uppercase opacity-60 truncate">${ext.setor}</span>
                            <span class="text-[9px] font-bold text-slate-800 truncate">${arg.event.title}</span>
                        </div>
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
        let dataLimpa = "";
        if (typeof e.data === 'string') {
            dataLimpa = e.data.split('T')[0].split(' ')[0];
        }

        if (dataLimpa) {
            const ofi = oficiantes.find(o => String(o.id) === String(e.id_oficiante));
            calendar.addEvent({
                title: e.nome_oficiante,
                start: dataLimpa,
                allDay: true,
                extendedProps: {
                    setor: e.setor,
                    turno: e.turno,
                    foto1: ofi ? ofi.foto1 : '',
                    foto2: ofi ? ofi.foto2 : ''
                }
            });
        }
    });
}

async function uploadParaCloudinary(file) {
    if (!file) return "";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await response.json();
        // Tratamento específico para o erro de 'Unsigned Upload' que apareceu na sua imagem
        if (data.error) {
            if (data.error.message.includes("whitelist")) {
                throw new Error("Erro de Configuração: O seu preset no Cloudinary precisa estar como 'Unsigned'.");
            }
            throw new Error(data.error.message);
        }
        return data.secure_url;
    } catch (error) {
        console.error("⚠️ Erro Cloudinary:", error);
        alert(error.message);
        throw error;
    }
}

function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex items-center gap-3">
            <div class="relative flex -space-x-3">
                <img src="${o.foto1 || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-full border-2 border-white object-cover shadow-sm bg-slate-50">
                <img src="${o.foto2 || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-full border-2 border-white object-cover shadow-sm bg-slate-50">
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 truncate">${o.nome}</p>
                <p class="text-[10px] text-slate-400">ID: ${o.id}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="editOficiante('${o.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                <button onclick="deleteOficiante('${o.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
            <td class="p-4 text-sm font-medium text-slate-700">${e.data.split('T')[0]}</td>
            <td class="p-4 font-bold text-slate-900">${e.nome_oficiante}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100">${e.setor}</span></td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-300 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getSetorColorClass(setor) {
    switch(setor) {
        case 'Batistério': return 'bg-blue-50 border-blue-500 text-blue-900';
        case 'Recepção': return 'bg-amber-50 border-amber-500 text-amber-900';
        case 'Selamento': return 'bg-emerald-50 border-emerald-500 text-emerald-900';
        default: return 'bg-slate-50 border-slate-500 text-slate-900';
    }
}

document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btnSalvar = e.target.querySelector('button[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Enviando fotos...";

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
        // O erro amigável já é disparado no uploadParaCloudinary
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "Salvar Cadastro";
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
    } else {
        alert(res.message);
    }
};

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

    if (tab === 'calendar' && calendar) {
        setTimeout(() => calendar.updateSize(), 100);
    }
}

function updateOficianteSelect() {
    const s = document.getElementById('escala-oficiante');
    if (s) s.innerHTML = '<option value="">Selecione...</option>' + oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
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

function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}

window.deleteOficiante = async (id) => {
    if (confirm("Excluir oficiante?")) {
        const res = await apiCall({ action: "deleteOficiante", id });
        if (res.status === "ok") fetchData();
    }
};

window.deleteEscalaItem = async (id, data, turno) => {
    if (confirm("Remover item da escala?")) {
        const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
        if (res.status === "ok") fetchData();
    }
};

window.editOficiante = (id) => {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    openOficianteModal();
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
};
