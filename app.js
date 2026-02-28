/**
 * Configurações Globais e Variáveis de Estado
 */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

let oficiantes = []; // Armazena a lista completa de oficiantes vindos do banco
let escala = [];      // Armazena todos os eventos da escala
let calendar;        // Instância do FullCalendar
let currentUser = null; // Informações do usuário logado via Google Auth

/**
 * Inicialização do Sistema
 * Executado quando o DOM e todos os recursos externos são carregados.
 */
window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons(); // Inicializa ícones da biblioteca Lucide
    initCalendar(); // Configura o calendário
    fetchData();    // Busca dados iniciais da API
};

/**
 * Configuração do FullCalendar
 * Define visual, idioma, cabeçalho e a lógica de renderização dos eventos.
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
        // Personalização visual do evento no calendário (fotos e nomes)
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
        },
        // Atribui classes CSS específicas baseadas no setor para cores diferentes
        eventClassNames: function(arg) {
            const setor = arg.event.extendedProps.setor || '';
            if (setor.includes('Batist')) return ['bg-batisterio'];
            if (setor.includes('Recep')) return ['bg-recepcao'];
            if (setor.includes('Selam')) return ['bg-selamento'];
            return [];
        }
    });
    calendar.render();
}

/**
 * Autenticação via Google Identity Services
 * Decodifica o JWT retornado pelo Google e atualiza a UI.
 */
function handleCredentialResponse(response) {
    // Decodificação manual do token JWT
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    
    const user = JSON.parse(jsonPayload);
    currentUser = user;
    
    // Atualização da Interface pós-login
    document.getElementById('loginContainer').classList.add('hidden');
    const info = document.getElementById('userInfo');
    if (info) {
        info.classList.remove('hidden');
        document.getElementById('userName').innerText = user.name;
        document.getElementById('userPic').src = user.picture;
    }
    
    // Exibe elementos restritos a administradores
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

/**
 * Logout do Sistema
 */
function logout() {
    currentUser = null;
    location.reload();
}

/**
 * Comunicação Centralizada com a API (Google Apps Script)
 * @param {Object} data - Payload contendo a 'action' e dados necessários.
 * @returns {Promise<Object>} - Resposta da API parseada em JSON.
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
        console.error("Erro na chamada da API:", e);
        return { status: "error", message: "Erro de conexão com o servidor." };
    } finally {
        showLoading(false);
    }
}

/**
 * Sincronização de Dados
 * Busca as listas de oficiantes e escalas e atualiza todos os componentes da tela.
 */
async function fetchData() {
    // Busca Oficiantes
    const resOficiantes = await apiCall({ action: "listOficiantes" });
    if (resOficiantes.status === "ok") {
        oficiantes = resOficiantes.data;
        renderOficiantes();
        updateOficianteSelect();
    }

    // Busca Escala
    const resEscala = await apiCall({ action: "listEscala" });
    if (resEscala.status === "ok") {
        escala = resEscala.data;
        renderEscalaTable();
        updateCalendar();
    }
}

/**
 * Upload de Imagens para o Cloudinary (Unsigned)
 * @param {File} file - Arquivo de imagem obtido via input file.
 * @returns {Promise<string|null>} - URL da imagem hospedada ou null em caso de falha.
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
        
        if (!response.ok) return null;
        const data = await response.json();
        return data.secure_url || ""; 
    } catch (error) {
        console.error("Falha no upload Cloudinary:", error);
        return null;
    }
}

/**
 * Manipulador do Formulário de Oficiantes (Adição e Edição)
 * Lida com o upload sequencial de fotos antes de enviar os dados para a planilha.
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
        const file1 = document.getElementById('fotoInput1')?.files[0];
        const file2 = document.getElementById('fotoInput2')?.files[0];
        
        // Recupera dados atuais se for uma edição para não sobrescrever fotos com vazio
        const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
        let url1 = ori ? ori.foto1 : "";
        let url2 = ori ? ori.foto2 : "";

        // Processa Upload da Foto 1 (Principal)
        if (file1) {
            const uploadedUrl = await uploadParaCloudinary(file1);
            if (uploadedUrl) url1 = uploadedUrl;
            else throw new Error("Erro ao processar Foto 1 no servidor de imagens.");
        }

        // Processa Upload da Foto 2 (Opcional)
        if (file2) {
            const uploadedUrl = await uploadParaCloudinary(file2);
            if (uploadedUrl) url2 = uploadedUrl;
        }

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
            e.target.reset();
            alert("Cadastro realizado com sucesso!");
        } else {
            alert("Erro no servidor: " + res.message);
        }
    } catch (err) {
        alert("Erro no processo: " + err.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerText = originalBtnText;
        }
    }
};

/**
 * Manipulador do Formulário de Escala
 */
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
    if (res.status === "ok") { 
        closeModal('modal-escala'); 
        fetchData(); 
    } else {
        alert(res.message);
    }
};

/**
 * Renderiza os cards de Oficiantes na tela de Gerenciamento
 */
function renderOficiantes() {
    const container = document.getElementById('oficiantes-list');
    if (!container) return;
    
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Renderiza a tabela de escalas (Lista)
 */
function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b hover:bg-blue-50/30 transition">
            <td class="p-4 text-sm font-medium text-slate-700">${new Date(e.data).toLocaleDateString('pt-br')}</td>
            <td class="p-4"><span class="text-sm font-bold text-slate-900">${e.nome_oficiante}</span></td>
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Atualiza os eventos no calendário baseando-se nos dados da escala
 */
function updateCalendar() {
    if (!calendar) return;
    calendar.removeAllEvents();
    
    escala.forEach(e => {
        // Busca objeto do oficiante para obter as fotos
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
 * Define classes CSS para cores de acordo com o setor
 */
function getSetorClass(setor) {
    const s = (setor || "").toLowerCase();
    if (s.includes('batist')) return 'bg-batisterio';
    if (s.includes('recep')) return 'bg-recepcao';
    if (s.includes('sela')) return 'bg-selamento';
    return 'bg-slate-100';
}

/**
 * Gerenciamento de Abas da Interface
 * @param {string} tab - ID da aba ('calendar', 'manage', 'list')
 */
function switchTab(tab) {
    // Esconde todas as seções
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(`sec-${tab}`);
    if (sec) sec.classList.remove('hidden');
    
    // Atualiza visual dos botões do menu
    document.querySelectorAll('main > div button').forEach(b => {
        b.classList.remove('border-blue-600', 'text-blue-600');
        b.classList.add('border-transparent', 'text-slate-500');
    });
    
    const tabBtn = document.getElementById(`tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('border-blue-600', 'text-blue-600');
    
    // Força redimensionamento do calendário se for a aba ativa
    if (tab === 'calendar' && calendar) calendar.updateSize();
}

/**
 * Exportação da Escala para PDF usando jsPDF e autoTable
 */
function generateProfessionalPDF() {
    if (typeof window.jspdf === 'undefined') return alert("Biblioteca PDF não carregada.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const monthTitle = calendar ? calendar.view.title : "Escala";
    
    doc.setFontSize(20);
    doc.text(`Escala de Oficiantes - ${monthTitle}`, 15, 20);
    
    // Ordena dados por data antes de gerar a tabela
    const filteredData = [...escala].sort((a, b) => new Date(a.data) - new Date(b.data));
    const rows = filteredData.map(e => [
        new Date(e.data).toLocaleDateString('pt-br'), 
        e.nome_oficiante, 
        e.setor, 
        e.turno
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Data', 'Oficiante', 'Setor', 'Turno']],
        body: rows,
        headStyles: { fillColor: [59, 130, 246] },
        theme: 'striped'
    });
    
    doc.save(`Escala_${monthTitle.replace(/\s/g, '_')}.pdf`);
}

/**
 * Controla a visibilidade do overlay de carregamento
 */
function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}

/**
 * Modais: Abertura e Fechamento
 */
function openOficianteModal() {
    document.getElementById('form-oficiante').reset();
    document.getElementById('oficiante-id').value = '';
    document.getElementById('oficiante-modal-title').innerText = 'Novo Oficiante';
    document.getElementById('modal-oficiante').style.display = 'flex';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

/**
 * Atualiza o dropdown de seleção de oficiantes no formulário de escala
 */
function updateOficianteSelect() {
    const select = document.getElementById('escala-oficiante');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um oficiante...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

/**
 * Exclusão de itens da escala
 */
async function deleteEscalaItem(id, data, turno) {
    if (!confirm("Remover este oficiante deste dia?")) return;
    const res = await apiCall({ action: "deleteEscala", id_oficiante: id, data, turno });
    if (res.status === "ok") fetchData();
}

/**
 * Exclusão de cadastro de oficiante
 */
async function deleteOficiante(id) {
    if (!confirm("Excluir cadastro permanentemente? Isso pode afetar escalas passadas.")) return;
    const res = await apiCall({ action: "deleteOficiante", id: id });
    if (res.status === "ok") fetchData();
}

/**
 * Carrega dados no modal para edição de um oficiante
 * @param {string} id - ID do oficiante a ser editado
 */
function editOficiante(id) {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    
    openOficianteModal();
    document.getElementById('oficiante-modal-title').innerText = 'Editar Cadastro';
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
    // Nota: Inputs de arquivo não podem ser preenchidos programaticamente por segurança.
}
