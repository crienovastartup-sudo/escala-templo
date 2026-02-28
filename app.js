/**
 * @fileoverview Sistema de Gestão de Escalas - EscalaOficial
 * @version 2.0.0
 * @author Equipe de Desenvolvimento
 * @description Script principal para gerenciamento de oficiantes, escalas mensais,
 * integração com Google Apps Script (Sheets), Cloudinary API e geração de relatórios PDF.
 */

// =============================================================================
// 1. CONFIGURAÇÕES E CONSTANTES GLOBAIS
// =============================================================================

/** @constant {string} API_URL - Endpoint do Google Apps Script que atua como Backend */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

/** @constant {string} CLOUDINARY_URL - Endpoint para upload de imagens */
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dwlrxb6a0/image/upload";

/** @constant {string} CLOUDINARY_UPLOAD_PRESET - Configuração de diretório no Cloudinary */
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

/** * @description Definição padronizada de turnos e horários.
 * Utilizado para automatizar a inserção de horários no banco e PDF.
 */
const CONFIG_TURNOS = {
    "PRIMEIRO": { inicio: "07:00", fim: "12:00", label: "1º Turno (Manhã)" },
    "SEGUNDO":  { inicio: "12:00", fim: "17:00", label: "2º Turno (Tarde)" },
    "TERCEIRO": { inicio: "17:00", fim: "21:00", label: "3º Turno (Noite)" }
};

// =============================================================================
// 2. ESTADO DA APLICAÇÃO (STATE MANAGEMENT)
// =============================================================================

/** @type {Array<Object>} Lista de todos os oficiantes cadastrados */
let oficiantes = [];

/** @type {Array<Object>} Lista de todos os registros de escala ativos */
let escala = [];

/** @type {Object|null} Instância do FullCalendar */
let calendar = null;

/** @type {Object|null} Dados do usuário autenticado via Google */
let currentUser = null;

// =============================================================================
// 3. INICIALIZAÇÃO DO SISTEMA
// =============================================================================

/**
 * Evento disparado quando o DOM está completamente carregado.
 * Inicia os ícones, o calendário e a primeira busca de dados.
 */
window.onload = async () => {
    console.log("🟢 Sistema EscalaOficial iniciado.");
    
    // Inicializa ícones da biblioteca Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Inicializa o componente de calendário
    initCalendar();

    // Busca dados iniciais do servidor
    await fetchData();
};

/**
 * Busca todos os dados necessários do Google Sheets.
 * Implementa uma sequência lógica para garantir que oficiantes existam antes da escala.
 */
async function fetchData() {
    console.group("📡 Sincronização de Dados");
    showLoading(true);

    try {
        // 1. Buscar Oficiantes
        const resOficiantes = await apiCall({ action: "listOficiantes" });
        if (resOficiantes.status === "ok") {
            oficiantes = resOficiantes.data;
            console.log(`✅ ${oficiantes.length} Oficiantes carregados.`);
            renderOficiantes();
            updateOficianteSelect();
        }

        // 2. Buscar Escala
        const resEscala = await apiCall({ action: "listEscala" });
        if (resEscala.status === "ok") {
            escala = resEscala.data;
            console.log(`✅ ${escala.length} Registros de escala carregados.`);
            renderEscalaTable();
            applyFilters(); // Atualiza o calendário com os dados novos
        }
    } catch (error) {
        console.error("❌ Falha crítica na busca de dados:", error);
    } finally {
        showLoading(false);
        console.groupEnd();
    }
}

// =============================================================================
// 4. COMUNICAÇÃO COM API (BACKEND)
// =============================================================================

/**
 * Wrapper universal para chamadas Fetch ao Google Apps Script.
 * @param {Object} data - Objeto contendo 'action' e payload.
 * @returns {Promise<Object>} Resposta JSON do servidor.
 */
async function apiCall(data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // Opcional dependendo da config do GAS, mas 'cors' é preferível
            body: JSON.stringify(data)
        });

        // Nota: Como o GAS as vezes redireciona, o tratamento de resposta 
        // em sistemas reais pode exigir um redirecionamento de link.
        // Aqui assumimos que o GAS retorna o JSON diretamente.
        
        // Simulação de resposta para fins de robustez caso o fetch falhe em ambientes restritos
        const result = await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
        return await result.json();
    } catch (error) {
        console.error("⚠️ Erro na apiCall:", error);
        return { status: "error", message: error.message };
    }
}

// =============================================================================
// 5. GESTÃO DO CALENDÁRIO (FULLCALENDAR)
// =============================================================================

/**
 * Configura e renderiza o FullCalendar com suporte a visualização customizada.
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
        buttonText: {
            today: 'Hoje',
            month: 'Mês'
        },
        // Renderização customizada para mostrar fotos dos oficiantes nos cards do calendário
        eventContent: function(arg) {
            const ext = arg.event.extendedProps;
            const bgClass = getSetorColorClass(ext.setor);
            
            let html = `
                <div class="p-1 rounded shadow-sm ${bgClass} border-l-4 overflow-hidden w-full">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[9px] font-black uppercase truncate">${ext.setor}</span>
                        <span class="text-[8px] font-medium italic opacity-70">${ext.turno}</span>
                    </div>
                    <div class="text-[10px] font-bold text-slate-900 leading-tight mb-1 truncate">
                        ${arg.event.title}
                    </div>
                    <div class="flex -space-x-1.5 mt-1">
                        ${ext.foto1 ? `<img src="${ext.foto1}" class="w-5 h-5 rounded-full border border-white bg-slate-200 object-cover shadow-sm">` : ''}
                        ${ext.foto2 ? `<img src="${ext.foto2}" class="w-5 h-5 rounded-full border border-white bg-slate-200 object-cover shadow-sm">` : ''}
                    </div>
                </div>
            `;
            return { html };
        }
    });
    
    calendar.render();
}

/**
 * Retorna a classe CSS de cor baseada no setor.
 * @param {string} setor 
 * @returns {string} Classe Tailwind/CSS
 */
function getSetorColorClass(setor) {
    switch(setor) {
        case 'Batistério': return 'bg-blue-50 border-blue-400 text-blue-800';
        case 'Recepção': return 'bg-yellow-50 border-yellow-400 text-yellow-800';
        case 'Selamento': return 'bg-green-50 border-green-400 text-green-800';
        default: return 'bg-slate-50 border-slate-400 text-slate-800';
    }
}

/**
 * Filtra os eventos da escala e atualiza a visualização do calendário.
 */
function applyFilters() {
    if (!calendar) return;

    const fSetor = document.getElementById('filter-setor')?.value;
    const fTurno = document.getElementById('filter-turno')?.value;
    const fOficiante = document.getElementById('filter-oficiante')?.value;

    calendar.removeAllEvents();

    const dataFiltrada = escala.filter(item => {
        const matchSetor = !fSetor || item.setor === fSetor;
        const matchTurno = !fTurno || item.turno === fTurno;
        const matchOfi = !fOficiante || String(item.id_oficiante) === String(fOficiante);
        return matchSetor && matchTurno && matchOfi;
    });

    dataFiltrada.forEach(e => {
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

/**
 * Limpa todos os filtros e reseta a visualização.
 */
function clearFilters() {
    document.getElementById('filter-setor').value = "";
    document.getElementById('filter-turno').value = "";
    document.getElementById('filter-oficiante').value = "";
    applyFilters();
}

// =============================================================================
// 6. UPLOAD E GESTÃO DE MÍDIA (CLOUDINARY)
// =============================================================================

/**
 * Realiza o upload de uma imagem para o Cloudinary.
 * @param {File} file - Arquivo de imagem do input.
 * @returns {Promise<string>} URL da imagem hospedada.
 */
async function uploadParaCloudinary(file) {
    if (!file) return "";
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_URL, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error("❌ Erro no upload Cloudinary:", error);
        return "";
    }
}

// =============================================================================
// 7. FORMULÁRIOS E OPERAÇÕES CRUD
// =============================================================================

/**
 * Submissão do formulário de Oficiantes (Adicionar/Editar).
 */
document.getElementById('form-oficiante').onsubmit = async (e) => {
    e.preventDefault();
    showLoading(true);

    const id = document.getElementById('oficiante-id').value;
    const nome = document.getElementById('oficiante-nome').value;
    const f1 = document.getElementById('fotoInput1').files[0];
    const f2 = document.getElementById('fotoInput2').files[0];

    // Mantém URLs antigas se não houver novo upload durante a edição
    let url1 = id ? oficiantes.find(o => String(o.id) === String(id))?.foto1 : "";
    let url2 = id ? oficiantes.find(o => String(o.id) === String(id))?.foto2 : "";

    if (f1) url1 = await uploadParaCloudinary(f1);
    if (f2) url2 = await uploadParaCloudinary(f2);

    const payload = {
        action: id ? "updateOficiante" : "addOficiante",
        id: id || Date.now(), // Gera ID temporário para novos
        nome,
        foto1: url1,
        foto2: url2
    };

    const res = await apiCall(payload);
    
    if (res.status === "ok") {
        closeModal('modal-oficiante');
        document.getElementById('form-oficiante').reset();
        await fetchData();
    } else {
        alert("Erro ao salvar oficiante: " + res.message);
    }
    showLoading(false);
};

/**
 * Submissão do formulário de Escala.
 */
document.getElementById('form-escala').onsubmit = async (e) => {
    e.preventDefault();
    showLoading(true);

    const ofiSelect = document.getElementById('escala-oficiante');
    const turnoKey = document.getElementById('escala-turno').value;
    const infoTurno = CONFIG_TURNOS[turnoKey];

    const payload = {
        action: "addEscala",
        data: document.getElementById('escala-data').value,
        id_oficiante: ofiSelect.value,
        nome_oficiante: ofiSelect.options[ofiSelect.selectedIndex].text,
        setor: document.getElementById('escala-setor').value,
        turno: turnoKey,
        hora_inicio: infoTurno.inicio,
        hora_fim: infoTurno.fim
    };

    const res = await apiCall(payload);

    if (res.status === "ok") {
        closeModal('modal-escala');
        await fetchData();
    } else {
        alert("Erro ao agendar: " + res.message);
    }
    showLoading(false);
};

// =============================================================================
// 8. RENDERIZAÇÃO DE INTERFACE (UI)
// =============================================================================

/**
 * Renderiza os cards na aba de Oficiantes.
 */
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;

    if (oficiantes.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center py-10 text-slate-400">Nenhum oficiante cadastrado.</p>`;
        return;
    }

    container.innerHTML = oficiantes.map(o => `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-colors group">
            <div class="flex items-center gap-4">
                <div class="flex -space-x-3">
                    <img src="${o.foto1 || 'https://via.placeholder.com/100'}" class="w-14 h-14 rounded-full border-2 border-white object-cover bg-slate-100 shadow-sm">
                    <img src="${o.foto2 || 'https://via.placeholder.com/100'}" class="w-14 h-14 rounded-full border-2 border-white object-cover bg-slate-100 shadow-sm">
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">${o.nome}</h4>
                    <p class="text-[10px] text-slate-400 uppercase font-semibold">ID: ${o.id}</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="editOficiante('${o.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <i data-lucide="edit-3" class="w-5 h-5"></i>
                </button>
                <button onclick="deleteOficiante('${o.id}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <i data-lucide="user-minus" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

/**
 * Renderiza a tabela de registros na aba de Configurar Escala.
 */
function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;

    if (escala.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400">Nenhum agendamento encontrado.</td></tr>`;
        return;
    }

    // Ordenar por data decrescente (mais recentes primeiro)
    const sortedEscala = [...escala].sort((a, b) => new Date(b.data) - new Date(a.data));

    tbody.innerHTML = sortedEscala.map(e => {
        const bgClass = getSetorColorClass(e.setor);
        return `
            <tr class="hover:bg-slate-50 transition-colors border-b last:border-0">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-700">${new Date(e.data + 'T00:00:00').toLocaleDateString('pt-br')}</span>
                        <span class="text-[10px] text-slate-400 italic">${e.data}</span>
                    </div>
                </td>
                <td class="p-4 font-bold text-slate-800">${e.nome_oficiante}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-[10px] font-black uppercase ${bgClass}">${e.setor}</span>
                    <span class="ml-2 text-[11px] text-slate-500">${e.turno}</span>
                </td>
                <td class="p-4 text-right">
                    <button onclick="deleteEscalaItem('${e.id_oficiante}', '${e.data}', '${e.turno}')" class="p-2 text-slate-300 hover:text-red-600 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

/**
 * Atualiza as listas de seleção (Selects) de oficiantes nos formulários e filtros.
 */
function updateOficianteSelect() {
    const selects = [document.getElementById('escala-oficiante'), document.getElementById('filter-oficiante')];
    const options = oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    
    selects.forEach(s => {
        if (!s) return;
        const isFilter = s.id === 'filter-oficiante';
        s.innerHTML = (isFilter ? '<option value="">Todos os Oficiantes</option>' : '<option value="">Selecione um Oficiante</option>') + options;
    });
}

// =============================================================================
// 9. UTILITÁRIOS E NAVEGAÇÃO
// =============================================================================

function switchTab(tabId) {
    // Esconde todas as seções
    document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
    // Mostra a selecionada
    document.getElementById(`sec-${tabId}`).classList.remove('hidden');
    
    // Atualiza estilo das abas
    document.querySelectorAll('button[id^="tab-"]').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-slate-500');
    });
    
    const activeTab = document.getElementById(`tab-${tabId}`);
    activeTab.classList.add('border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-slate-500');

    // Força redimensionamento do FullCalendar se abrir a aba do calendário
    if (tabId === 'calendar' && calendar) {
        setTimeout(() => calendar.updateSize(), 100);
    }
}

function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).style.display = 'none';
}

function openOficianteModal() {
    document.getElementById('oficiante-modal-title').innerText = "Novo Oficiante";
    document.getElementById('oficiante-id').value = "";
    document.getElementById('form-oficiante').reset();
    document.getElementById('modal-oficiante').classList.remove('hidden');
    document.getElementById('modal-oficiante').style.display = 'flex';
}

function openEscalaModal() {
    document.getElementById('modal-escala').classList.remove('hidden');
    document.getElementById('modal-escala').style.display = 'flex';
}

/**
 * Carrega dados do oficiante no modal para edição.
 */
window.editOficiante = (id) => {
    const o = oficiantes.find(item => String(item.id) === String(id));
    if (!o) return;

    document.getElementById('oficiante-modal-title').innerText = "Editar Oficiante";
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
    
    document.getElementById('modal-oficiante').classList.remove('hidden');
    document.getElementById('modal-oficiante').style.display = 'flex';
};

/**
 * Deleta um oficiante após confirmação.
 */
window.deleteOficiante = async (id) => {
    if (confirm("Deseja realmente excluir este oficiante? Isso não removerá os registros históricos da escala.")) {
        await apiCall({ action: "deleteOficiante", id });
        await fetchData();
    }
};

/**
 * Deleta um registro específico da escala.
 */
window.deleteEscalaItem = async (idOficiante, data, turno) => {
    if (confirm("Remover este oficiante desta data/turno?")) {
        await apiCall({
            action: "deleteEscala",
            id_oficiante: idOficiante,
            data: data,
            turno: turno
        });
        await fetchData();
    }
};

// =============================================================================
// 10. INTEGRAÇÃO GOOGLE AUTH (GSI)
// =============================================================================

/**
 * Callback executado após o login bem sucedido no Google.
 */
window.handleCredentialResponse = (response) => {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    currentUser = payload;

    // UI Updates
    document.getElementById('userName').innerText = payload.name;
    document.getElementById('userPic').src = payload.picture;
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('loginContainer').classList.add('hidden');

    // Habilita abas administrativas
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    
    console.log("👤 Usuário autenticado:", payload.email);
};

/**
 * Logout do sistema.
 */
window.logout = () => {
    location.reload(); // Forma mais simples de limpar o estado e tokens do GSI
};

// =============================================================================
// 11. GERAÇÃO DE PDF PROFISSIONAL
// =============================================================================

/**
 * Gera um documento PDF formatado com a escala atual visível (respeita filtros).
 */
window.generateProfessionalPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Configurações Estéticas do PDF
    const azulTemplo = [30, 41, 59];
    
    // Cabeçalho
    doc.setFillColor(...azulTemplo);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ESCALA DE OFICIANTES", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dataEmissao = new Date().toLocaleDateString('pt-br');
    doc.text(`Emitido em: ${dataEmissao}`, 105, 30, { align: "center" });

    // Preparação dos dados da tabela para o PDF
    // Usamos apenas os dados que estão visíveis no calendário (respeitando filtros)
    const eventosCalendario = calendar.getEvents();
    const rows = eventosCalendario.map(ev => {
        const p = ev.extendedProps;
        return [
            new Date(ev.start).toLocaleDateString('pt-br'),
            ev.title,
            p.setor,
            p.turno
        ];
    });

    // Ordenar por data
    rows.sort((a, b) => {
        const da = a[0].split('/').reverse().join('');
        const db = b[0].split('/').reverse().join('');
        return da.localeCompare(db);
    });

    // Tabela Automática
    doc.autoTable({
        head: [['Data', 'Oficiante', 'Setor', 'Turno']],
        body: rows,
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: azulTemplo, fontSize: 11, halign: 'center' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 40, halign: 'center' },
            3: { cellWidth: 40, halign: 'center' }
        },
        didDrawPage: function (data) {
            // Rodapé
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("EscalaOficial - Sistema de Gestão Interna", 105, 285, { align: "center" });
        }
    });

    doc.save(`Escala_Oficial_${dataEmissao.replace(/\//g, '-')}.pdf`);
};

/**
 * FIM DO ARQUIVO - app.js
 * Desenvolvido para EscalaOficial.
 */
