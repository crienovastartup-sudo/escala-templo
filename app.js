/**
 * Configurações Globais e Variáveis de Estado
 * @constant {string} API_URL - Endpoint do Google Apps Script (Web App)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbz5n2N8iYhzWGH6Pz7T8aFPgMQ98s9HXLq-wmD-m7mv4vcpOqbUsztCsenJ6k6XVlNnJg/exec";

let oficiantes = []; // Lista de objetos dos oficiantes cadastrados
let escala = [];      // Lista de registros de agendamento na escala
let calendar;        // Instância global do FullCalendar
let currentUser = null; // Armazena dados do perfil logado via Google

/**
 * Inicialização do Sistema
 * Configura os ícones, o calendário e carrega os dados iniciais ao abrir a página.
 */
window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCalendar();
    fetchData();
};

/**
 * Configuração do FullCalendar
 * Define o comportamento visual e a renderização customizada dos eventos com fotos.
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
        // Renderização customizada do conteúdo do evento (HTML interno)
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
 * Callback de Autenticação do Google
 * Decodifica o token JWT e libera o acesso às funções administrativas.
 */
function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    
    currentUser = JSON.parse(jsonPayload);
    
    // Atualiza a interface para estado "Logado"
    document.getElementById('loginContainer').classList.add('hidden');
    const info = document.getElementById('userInfo');
    if (info) {
        info.classList.remove('hidden');
        document.getElementById('userName').innerText = currentUser.name;
        document.getElementById('userPic').src = currentUser.picture;
    }
    // Mostra botões e abas exclusivas para admin
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
 * Sincronização de Dados
 * Busca as listas de oficiantes e escalas da planilha.
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
        updateCalendar();
    }
}

/**
 * Upload de Imagens para o Cloudinary
 * Utiliza o modo "unsigned" (sem assinatura no frontend) para segurança e praticidade.
 */
async function uploadParaCloudinary(file) {
    const cloudName = "dwlrxb6a0"; 
    // Certifique-se de que este preset está configurado como 'Unsigned' no painel do Cloudinary
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

        if (!response.ok) {
            console.group("Erro no Cloudinary");
            console.error("Status:", response.status);
            console.error("Detalhes:", data);
            console.groupEnd();
            
            // Lança erro detalhado
            let msg = data.error ? data.error.message : "Erro desconhecido";
            throw new Error(`Cloudinary diz: ${msg}`);
        }
        
        return data.secure_url || ""; 
    } catch (error) {
        console.error("Falha no upload Cloudinary:", error);
        throw error;
    }
}

/**
 * Submissão do Formulário de Oficiante (Salvar/Editar)
 * Gerencia o ciclo: Upload de fotos -> Payload API -> Resposta do Servidor.
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
        const input1 = document.getElementById('fotoInput1');
        const input2 = document.getElementById('fotoInput2');
        
        if (!input1 || !input2) {
            throw new Error("Inputs de foto não encontrados.");
        }

        const file1 = input1.files[0];
        const file2 = input2.files[0];
        
        const ori = id ? oficiantes.find(o => String(o.id) === String(id)) : null;
        let url1 = ori ? ori.foto1 : "";
        let url2 = ori ? ori.foto2 : "";

        // Foto 1
        if (file1) {
            try {
                url1 = await uploadParaCloudinary(file1);
            } catch (err) {
                throw new Error("Erro na Foto 1: " + err.message);
            }
        }

        // Foto 2
        if (file2) {
            try {
                url2 = await uploadParaCloudinary(file2);
            } catch (err) {
                throw new Error("Erro na Foto 2: " + err.message);
            }
        }

        const payload = {
            action: id ? "updateOficiante" : "addOficiante",
            id: id,
            nome: document.getElementById('oficiante-nome').value,
            foto1: url1, 
            foto2: url2
        };

        if (btnSalvar) btnSalvar.innerText = "Gravando dados...";
        const res = await apiCall(payload);

        if (res.status === "ok") { 
            closeModal('modal-oficiante'); 
            fetchData(); 
            e.target.reset();
            alert("Salvo com sucesso!");
        } else {
            alert("Erro no servidor: " + res.message);
        }
    } catch (err) {
        console.error("Erro fatal:", err);
        alert(err.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerText = originalBtnText;
        }
    }
};

/**
 * Gerenciamento de Escala (Adicionar Evento)
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
 * Renderiza Cards de Oficiantes
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

/**
 * Renderiza Tabela Administrativa da Escala
 */
function renderEscalaTable() {
    const tbody = document.getElementById('escala-table-body');
    if (!tbody) return;
    tbody.innerHTML = escala.map(e => `
        <tr class="border-b hover:bg-slate-50 transition">
            <td class="p-4 text-sm font-medium text-slate-700">${new Date(e.data).toLocaleDateString('pt-br')}</td>
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
 * Sincroniza os Eventos com o FullCalendar
 */
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
 * Navegação por Abas
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

/**
 * Controle do Overlay de Carregamento
 */
function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.toggle('hidden', !show);
}

/**
 * Funções de Controle de Modais
 */
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

/**
 * Atualiza dropdown de escolha no formulário de escala
 */
function updateOficianteSelect() {
    const select = document.getElementById('escala-oficiante');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>' + 
        oficiantes.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
}

/**
 * Operações de Exclusão
 */
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

/**
 * Prepara modal para edição de cadastro existente
 */
function editOficiante(id) {
    const o = oficiantes.find(of => String(of.id) === String(id));
    if (!o) return;
    openOficianteModal();
    document.getElementById('oficiante-modal-title').innerText = 'Editar Cadastro';
    document.getElementById('oficiante-id').value = o.id;
    document.getElementById('oficiante-nome').value = o.nome;
}

/**
 * Exportação em PDF
 */
function generateProfessionalPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Escala de Oficiantes", 15, 15);
    const rows = escala.map(e => [new Date(e.data).toLocaleDateString('pt-br'), e.nome_oficiante, e.setor, e.turno]);
    doc.autoTable({ head: [['Data', 'Nome', 'Setor', 'Turno']], body: rows, startY: 20 });
    doc.save("escala.pdf");
}
