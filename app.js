/**
 * @fileoverview Sistema de Gestão de Escalas - EscalaOficial
 * @version 2.2.0
 * @author Equipa de Desenvolvemento
 * @description Este ficheiro xestiona a lóxica do frontend, incluíndo a integración 
 * coa API de Google Sheets, a carga de imaxes en Cloudinary e a renderización 
 * do calendario dinámico.
 */

// =============================================================================
// 1. CONFIGURACIÓNS E CONSTANTES GLOBAIS
// =============================================================================

/** @constant {string} API_URL - Endpoint do Google Apps Script para as operacións CRUD */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

/** @constant {string} CLOUDINARY_URL - Endpoint para o upload de imaxes */
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dwlrxb6a0/image/upload";

/** @constant {string} CLOUDINARY_UPLOAD_PRESET - Requírese configuración 'Unsigned' no panel de Cloudinary */
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

// Variables de estado globais
let oficiantes = []; // Almacena a lista completa de oficiantes
let escala = [];      // Almacena os rexistros de axenda
let calendar = null;  // Instancia do FullCalendar
let currentUser = null;

// =============================================================================
// 2. INICIALIZACIÓN DO SISTEMA
// =============================================================================

/**
 * Evento de carga da ventá. Prepara a UI e solicita os datos iniciais.
 */
window.onload = () => {
    console.log("🟢 Sistema EscalaOficial iniciado.");
    // Inicializa iconas de Lucide se a libraría está dispoñible
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCalendar();
    fetchData();
};

// =============================================================================
// 3. COMUNICACIÓN COA API (GOOGLE APPS SCRIPT)
// =============================================================================

/**
 * Realiza chamadas POST á API de Google.
 * @param {Object} data - Obxecto coa acción e os parámetros necesarios.
 * @returns {Promise<Object>} Resposta da API en formato JSON.
 */
async function apiCall(data) {
    showLoading(true); // Bloquea a UI durante a carga
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error("❌ Erro na API:", e);
        return { status: "error", message: "Falha na comunicação com o servidor." };
    } finally {
        showLoading(false);
    }
}

/**
 * Orquestra a descarga de datos e a súa posterior renderización nos compoñentes de UI.
 */
async function fetchData() {
    console.group("📡 Sincronización de Dados");
    
    // Obtén e renderiza oficiantes
    const resOficiantes = await apiCall({ action: "listOficiantes" });
    if (resOficiantes && resOficiantes.status === "ok") {
        oficiantes = resOficiantes.data;
        renderOficiantes();
        updateOficianteSelect();
    }

    // Obtén e sincroniza a escala co calendario
    const resEscala = await apiCall({ action: "listEscala" });
    if (resEscala && resEscala.status === "ok") {
        escala = resEscala.data;
        renderEscalaTable();
        updateCalendar(); 
    }
    console.groupEnd();
}

// =============================================================================
// 4. LÓXICA DO CALENDARIO E TRATAMENTO DE DATAS
// =============================================================================

/**
 * Configura a instancia do FullCalendar con renderización personalizada.
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
        // Inxección de HTML personalizado dentro de cada celda de evento
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            const bgClass = getSetorColorClass(ext.setor);
            let html = `
                <div class="p-1 rounded shadow-sm ${bgClass} border-l-4 overflow-hidden w-full">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[9px] font-black uppercase truncate">${ext.setor}</span>
                    </div>
                    <div class="text-[10px] font-bold text-slate-900 leading-tight truncate">
                        ${arg.event.title}
                    </div>
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
 * Sincroniza o array 'escala' co calendario, limpando os formatos de data do Google Sheets.
 */
function updateCalendar() {
    if (!calendar) return;
    calendar.removeAllEvents();

    escala.forEach(e => {
        /** * NOTA PARA PROGRAMADORES: Google Sheets pode enviar datas como strings ISO (T00:00:00).
         * FullCalendar require YYYY-MM-DD para evitar desprazamentos de fuso horario.
         */
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

// =============================================================================
// 5. XESTIÓN DE IMAXES (CLOUDINARY)
// =============================================================================

/**
 * Sobe un ficheiro ao servidor de Cloudinary.
 * @param {File} file - Ficheiro de imaxe a subir.
 * @returns {Promise<string>} URL da imaxe aloxada.
 */
async function uploadParaCloudinary(file) {
    if (!file) return "";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.secure_url;
    } catch (error) {
        console.error("⚠️ Falha no upload Cloudinary:", error);
        alert("Erro no servidor de imagens. Verifique se o preset está como UNSIGNED.");
        throw error;
    }
}

// =============================================================================
// 6. RENDERIZACIÓN DE COMPOÑENTES DE UI
// =============================================================================

/**
 * Debuxa a lista de oficiantes no DOM usando templates literais.
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
                    <button onclick="editOficiante('${o.id}')" title="Editar" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="deleteOficiante('${o.id}')" title="Eliminar" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Xera a táboa administrativa de axendas.
 */
function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-4 text-sm font-medium text-slate-700">${e.data.split('T')[0]}</td>
            <td class="p-4 font-bold text-slate-900">${e.nome_oficiante}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100">${e.setor} - ${e.turno}</span></td>
            <td class="p-4 text-right">
                <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="text-slate-200 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Helper para asignar clases de CSS segundo o sector.
 */
function getSetorColorClass(setor) {
    switch(setor) {
        case 'Batistério': return 'bg-blue-50 border-blue-400 text-blue-800';
        case 'Recepção': return 'bg-yellow-50 border-yellow-400 text-yellow-800';
        case 'Selamento': return 'bg-green-50 border-green-400 text-green-800';
        default: return 'bg-slate-50 border-slate-400 text-slate-800';
    }
}

// =============================================================================
// 7. PROCESAMENTO DE FORMULARIOS
// =============================================================================

/**
 * Captura o envío do formulario de oficiantes. Xestiona o upload e a actualización/creación.
 */
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    const btnSalvar = e.target.querySelector('button[type="submit"]');
    const originalText = btnSalvar.innerText;
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Processando...";

    try {
        const id = document.getElementById('oficiante-id').value;
        const file1 = document.getElementById('fotoInput1').files[0];
        const file2 = document.getElementById('fotoInput2').files[0];
        
        const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
        
        // Só sube imaxes se se seleccionaron ficheiros novos, caso contrario mantén as URLs existentes
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
        alert("Falha no processo: " + err.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = originalText;
    }
};

/**
 * Envía novos rexistros de axenda á API.
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

// =============================================================================
// 8. NAVEGACIÓN E UTILIDADES DE UI
// =============================================================================

/**
 * Xestiona o cambio de pestanas e forzar a actualización do tamaño do calendario.
 */
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

    // O FullCalendar require un recalculo se se inicializa dentro dun contenedor oculto
    if (tab === 'calendar' && calendar) {
        setTimeout(() => calendar.updateSize(), 100);
    }
}

/**
 * Popula o select do formulario coa lista de oficiantes actualizada.
 */
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
    document.getElementById(id).classList.add('hidden');
}

function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}

// Exportación a ámbito global para chamadas dende o HTML (onclick)
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
