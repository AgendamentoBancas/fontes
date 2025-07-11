// Função auxiliar para gerar um ID único e legível
function gerarIdComposto(email, orientadorNome) {
    const emailSanitizado = email.replace(/[.#$[\]]/g, '_');
    const orientadorSanitizado = orientadorNome ? orientadorNome.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'sem_orientador';
    const idAleatorio = Math.random().toString(36).substring(2, 8);
    return `${emailSanitizado}_${orientadorSanitizado}_${idAleatorio}`;
}

let agendamentosExistentes = [];
let currentUserRole = null;
let currentUserName = null;

document.addEventListener('DOMContentLoaded', async () => {
    // --- VERIFICAÇÃO DE CONEXÃO COM FIREBASE ---
    if (typeof firebase === 'undefined') {
        console.error('ERRO FATAL: Biblioteca Firebase não carregada. Verifique o <script src="..."> no seu HTML.');
        alert('Erro: Firebase não carregado! Verifique a configuração no HTML.');
        document.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
        return;
    }
    if (typeof db === 'undefined' || db === null) {
        console.error('ERRO FATAL: Objeto Firestore (db) não inicializado. Verifique firebase.initializeApp() e firebase.firestore() no seu HTML.');
        alert('Erro: Conexão com o Firestore não estabelecida! Verifique a configuração do Firebase no HTML.');
        document.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
        return;
    }
    if (typeof auth === 'undefined' || auth === null) {
        console.error('ERRO FATAL: Objeto Firebase Auth (auth) não inicializado. Verifique firebase.auth() no seu HTML.');
        alert('Erro: Conexão com o Firebase Auth não estabelecida! Verifique a configuração do Firebase no HTML.');
        document.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
        return;
    }
    // --- FIM DA VERIFICAÇÃO DE CONEXÃO ---

    const dataInput = document.getElementById('data');
    const horaSelect = document.getElementById('hora');
    const bancasTableBody = document.querySelector('#bancasTable tbody');
    const bancasTableHead = document.querySelector('#bancasTable thead tr');
    const listarBancasBtn = document.getElementById('listarBancasBtn');
    const cadastrarBtn = document.getElementById('cadastrarBtn');
    const atualizarBtn = document.getElementById('atualizarBtn');
    const bancaForm = document.getElementById('bancaForm');
    const bancasContagemParagrafo = document.getElementById('bancasContagem');
    const editarSelecionadoBtn = document.getElementById('editarSelecionadoBtn');
    const deletarSelecionadoBtn = document.getElementById('deletarSelecionadoBtn');
    const localRadioButtons = document.querySelectorAll('input[name="local"]');
    const exportarCsvBtn = document.getElementById('exportarCsvBtn');
    const loginLogoutBtn = document.getElementById('loginLogoutBtn');
    const userInfoSpan = document.getElementById('userInfo');
    const adminAcoesDiv = document.getElementById('adminAcoes');

    // NOVOS ELEMENTOS DOM para a opção "Outro"
    const localOutroRadio = document.getElementById('localOutroRadio');
    const outroLocalDiv = document.getElementById('outroLocalDiv');
    const outroLocalInput = document.getElementById('outroLocalInput');

    let bancaSendoEditadaId = null;
    const HORARIOS_FIXOS_DISPONIVEIS = [
        "07:30", "09:00", "10:30", "13:30", "15:00", "16:30"
    ];

    // --- Listener para o estado de autenticação do Firebase ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                if (userDoc.exists) {
                    currentUserRole = userDoc.data().role;
                    currentUserName = user.email;
                } else {
                    currentUserRole = 'user';
                    currentUserName = user.email;
                    await db.collection('usuarios').doc(user.uid).set({ email: user.email, role: 'user' }, { merge: true });
                }
            } catch (error) {
                console.error("Erro ao buscar a role do usuário:", error);
                currentUserRole = 'user';
                currentUserName = user.email;
            }
            loginLogoutBtn.textContent = 'Sair (Admin)';
            loginLogoutBtn.style.backgroundColor = '#dc3545';
            userInfoSpan.textContent = `Logado como: ${currentUserName} (${currentUserRole === 'admin' ? 'Administrador' : 'Usuário Comum'})`;
        } else {
            currentUserRole = null;
            currentUserName = null;
            loginLogoutBtn.textContent = 'Logar como Administrador';
            loginLogoutBtn.style.backgroundColor = '#007bff';
            userInfoSpan.textContent = '';
        }
        updateUIVisibility();
    });

    // --- Lógica do botão Login/Logout ---
    loginLogoutBtn.addEventListener('click', async () => {
        if (auth.currentUser) {
            await auth.signOut();
            alert('Você foi desconectado.');
        } else {
            window.location.href = 'index.html';
        }
    });

    // --- Função para atualizar a visibilidade da UI ---
    function updateUIVisibility() {
        if (currentUserRole === 'admin') {
            atualizarBtn.style.display = 'block';
            adminAcoesDiv.style.display = 'block';
            if (!document.getElementById('thAcao')) {
                const th = document.createElement('th');
                th.id = 'thAcao';
                th.textContent = 'Ação';
                bancasTableHead.prepend(th);
            }
        } else {
            atualizarBtn.style.display = 'none';
            adminAcoesDiv.style.display = 'none';
            const th = document.getElementById('thAcao');
            if (th) {
                th.remove();
            }
            bancaSendoEditadaId = null;
            bancaForm.reset();
        }
        carregarBancasDoFirestore();
    }

    // --- FUNÇÕES DE CARREGAMENTO E EXIBIÇÃO DE BANCAS ---
    async function carregarBancasDoFirestore() {
        try {
            const snapshot = await db.collection('bancas').orderBy('data', 'asc').orderBy('horario', 'asc').get();
            agendamentosExistentes = [];
            let contagemTCC1 = 0;
            let contagemPFC2 = 0;

            snapshot.forEach(doc => {
                const dataBanca = doc.data();
                dataBanca.id = doc.id;
                agendamentosExistentes.push(dataBanca);
                if (dataBanca.tipoBanca === 'TCC 1') {
                    contagemTCC1++;
                } else if (dataBanca.tipoBanca === 'PFC-2') {
                    contagemPFC2++;
                }
            });
            exibirBancasNaTabela();
            document.getElementById('bancasInfo').textContent = `Total de bancas cadastradas: ${agendamentosExistentes.length}`;
            bancasContagemParagrafo.textContent = `TCC1: ${contagemTCC1} | PFC2: ${contagemPFC2}`;
        } catch (error) {
            console.error('Erro ao carregar bancas do Firestore: ', error);
            document.getElementById('bancasInfo').textContent = 'Erro ao carregar bancas. Verifique o console.';
            bancasContagemParagrafo.textContent = '';
        }
    }

    function exibirBancasNaTabela() {
        bancasTableBody.innerHTML = '';
        if (agendamentosExistentes.length === 0) {
            const colspan = currentUserRole === 'admin' ? 6 : 5;
            bancasTableBody.innerHTML = `<tr><td colspan="${colspan}">Nenhuma banca cadastrada.</td></tr>`;
            return;
        }

        agendamentosExistentes.forEach(banca => {
            const row = bancasTableBody.insertRow();
            row.id = `banca-${banca.id}`;
            
            if (currentUserRole === 'admin') {
                const actionCell = row.insertCell();
                const radioInput = document.createElement('input');
                radioInput.type = 'radio';
                radioInput.name = 'bancaSelecionada';
                radioInput.value = banca.id;
                actionCell.appendChild(radioInput);
            }

            const dataCell = row.insertCell();
            dataCell.textContent = banca.data || '';

            const horarioCell = row.insertCell();
            horarioCell.textContent = banca.horario || '';

            const localCell = row.insertCell();
            localCell.textContent = banca.local || '';

            const orientadorCell = row.insertCell();
            orientadorCell.textContent = banca.orientador || '';

            const discenteCell = row.insertCell();
            discenteCell.textContent = banca.discente || '';
        });
    }

    // --- FUNÇÕES DE AÇÃO (EDITAR E DELETAR) ---

    async function preencherFormularioParaEdicao(id) {
        if (currentUserRole !== 'admin') {
            alert('Você não tem permissão para editar bancas.');
            return;
        }
        try {
            const banca = agendamentosExistentes.find(b => b.id === id);
            if (!banca) {
                alert('Banca não encontrada para edição.');
                return;
            }

            bancaSendoEditadaId = id;

            document.getElementById('email').value = banca.email || '';
            document.querySelector(`input[name="tipoBanca"][value="${banca.tipoBanca}"]`).checked = true;
            document.getElementById('discente').value = banca.discente || '';
            document.getElementById('orientador').value = banca.orientador || '';
            document.getElementById('coorientador').value = banca.coorientador || '';
            document.getElementById('titulo').value = banca.titulo || '';
            document.getElementById('avaliador1').value = banca.avaliador1 || '';
            document.getElementById('avaliador2').value = banca.avaliador2 || '';
            
            dataInput.value = banca.data || ''; 
            
            // LÓGICA PARA PREENCHER O LOCAL (FIXO OU "OUTRO")
            const localRadio = document.querySelector(`input[name="local"][value="${banca.local}"]`);
            if (localRadio) {
                localRadio.checked = true;
                // A caixa de texto é escondida aqui apenas se o local for um dos fixos
                if (banca.local !== 'Outro') { // Se o local salvo NÃO é "Outro", esconde a caixa.
                   outroLocalDiv.style.display = 'none';
                   outroLocalInput.value = '';
                } else { // Se o local salvo É "Outro", mostra a caixa e preenche
                   outroLocalDiv.style.display = 'block';
                   outroLocalInput.value = banca.local || '';
                }
            } else {
                // Se o local da banca NÃO está entre os rádios fixos, é um "Outro" local
                localOutroRadio.checked = true;
                outroLocalDiv.style.display = 'block'; // Mostra a caixa de texto
                outroLocalInput.value = banca.local || ''; // Preenche com o local salvo
            }

            await atualizarHorariosDisponiveis(); // Atualiza horários com base na data e local (incluindo "Outro")
            document.getElementById('hora').value = banca.horario || '';

            cadastrarBtn.style.display = 'none';
            atualizarBtn.style.display = 'block';

            alert('Formulário preenchido para edição. Clique em "Atualizar Banca" para salvar as alterações.');
            bancaForm.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Erro ao preencher formulário para edição:', error);
            alert('Não foi possível preencher o formulário para edição. Verifique o console.');
        }
    }

    async function deletarBanca(id) {
        if (currentUserRole !== 'admin') {
            alert('Você não tem permissão para deletar bancas.');
            return;
        }
        if (!confirm('Tem certeza que deseja deletar esta banca?')) {
            return;
        }

        try {
            await db.collection('bancas').doc(id).delete();
            alert('Banca deletada com sucesso!');
            console.log('Banca deletada:', id);

            await carregarBancasDoFirestore();

            if (bancaSendoEditadaId === id) {
                bancaForm.reset();
                bancaSendoEditadaId = null;
                cadastrarBtn.style.display = 'block';
                atualizarBtn.style.display = 'none';
                atualizarHorariosDisponiveis();
            }

        } catch (error) {
            console.error('Erro ao deletar banca:', error);
            alert('Ocorreu um erro ao deletar a banca. Verifique o console.');
        }
    }

    // --- LÓGICA DE ENVIO/ATUALIZAÇÃO DO FORMULÁRIO (Função principal) ---
    cadastrarBtn.addEventListener('click', async (e) => {
        handleFormSubmission();
    });

    atualizarBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (currentUserRole !== 'admin') {
            alert('Você não tem permissão para atualizar bancas.');
            return;
        }
        if (!bancaSendoEditadaId) {
            alert('Nenhuma banca selecionada para atualização.');
            return;
        }
        await handleFormSubmission(true);
    });

    async function handleFormSubmission(isUpdate = false) {
        const camposObrigatorios = document.querySelectorAll('input[required], select[required], textarea[required]');
        let formularioValido = true;
        camposObrigatorios.forEach(campo => {
            if (campo.value.trim() === '') {
                campo.style.borderColor = 'red';
                formularioValido = false;
            } else {
                campo.style.borderColor = '#ccc';
            }
        });

        const tipoBancaChecked = document.querySelector('input[name="tipoBanca"]:checked');
        const localChecked = document.querySelector('input[name="local"]:checked');

        if (!tipoBancaChecked) {
            const radioGroupDiv = document.querySelector('.radio-group');
            if (radioGroupDiv) radioGroupDiv.style.border = '1px solid red';
            formularioValido = false;
        } else {
            const radioGroupDiv = document.querySelector('.radio-group');
            if (radioGroupDiv) radioGroupDiv.style.border = 'none';
        }

        if (!localChecked) {
            const localGroupDiv = document.querySelector('.local-group');
            if (localGroupDiv) localGroupDiv.style.border = '1px solid red';
            formularioValido = false;
        } else {
            const localGroupDiv = document.querySelector('.local-group');
            if (localGroupDiv) localGroupDiv.style.border = 'none';
        }

        // --- VALIDAÇÃO ESPECÍFICA PARA "OUTRO" LOCAL ---
        let localFinal = '';
        if (localChecked && localChecked.value === 'Outro') {
            localFinal = outroLocalInput.value.trim();
            if (localFinal === '') {
                outroLocalInput.style.borderColor = 'red';
                alert('Por favor, digite o local da banca.');
                formularioValido = false;
            } else {
                outroLocalInput.style.borderColor = '#ccc';
            }
        } else if (localChecked) {
            localFinal = localChecked.value;
        }
        // --- FIM DA VALIDAÇÃO ESPECÍFICA ---

        if (!formularioValido) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            console.error('ERRO: Formulário não preenchido completamente ou com erros.');
            return;
        }

        const formData = {
            email: document.getElementById('email').value.trim(),
            tipoBanca: tipoBancaChecked.value,
            discente: document.getElementById('discente').value.trim(),
            orientador: document.getElementById('orientador').value.trim(),
            coorientador: document.getElementById('coorientador').value.trim() || null,
            titulo: document.getElementById('titulo').value.trim(),
            avaliador1: document.getElementById('avaliador1').value.trim(),
            avaliador2: document.getElementById('avaliador2').value.trim(),
            data: document.getElementById('data').value,
            horario: document.getElementById('hora').value,
            local: localFinal // USA O VALOR FINAL DO LOCAL AQUI
        };

        if (!formData.data) {
            alert('Por favor, selecione uma data.');
            return;
        }
        if (!formData.horario) {
            alert('Por favor, selecione um horário disponível.');
            return;
        }
        if (!formData.local) {
            alert('Por favor, selecione um local.');
            return;
        }

        // INÍCIO DA VERIFICAÇÃO DE DUPLICIDADE
        try {
            let idParaIgnorarNaDuplicidade = isUpdate ? bancaSendoEditadaId : null; 

            const querySnapshot = await db.collection('bancas')
                                            .where('data', '==', formData.data)
                                            .where('horario', '==', formData.horario)
                                            .where('local', '==', formData.local)
                                            .get();

            if (!querySnapshot.empty) {
                let foundDuplicate = false;
                querySnapshot.forEach(doc => {
                    if (doc.id !== idParaIgnorarNaDuplicidade) { 
                        foundDuplicate = true;
                    }
                });

                if (foundDuplicate) {
                    alert('Erro: Este horário e local já estão agendados para outra banca.');
                    return;
                }
            }
        } catch (error) {
            console.error('Erro na verificação de duplicidade: ', error);
            alert('Erro ao verificar duplicidade.');
            return;
        }
        // --- FIM DA VERIFICAÇÃO DE DUPLICIDADE ---

        if (isUpdate) {
            if (currentUserRole !== 'admin') {
                alert('Você não tem permissão para atualizar bancas.');
                return;
            }
            try {
                const originalDocRef = db.collection('bancas').doc(bancaSendoEditadaId);
                const originalDoc = await originalDocRef.get();
                if (!originalDoc.exists) {
                    alert('Erro: Banca original não encontrada para atualização.');
                    return;
                }
                const originalData = originalDoc.data();

                if (originalData.email === formData.email && originalData.orientador === formData.orientador) {
                    await originalDocRef.update(formData); 
                    alert('Banca atualizada com sucesso!');
                    console.log('Banca atualizada:', bancaSendoEditadaId);
                } else {
                    const confirmChange = confirm('O e-mail ou orientador foi alterado. Isso irá criar uma nova banca com o novo identificador e remover a banca antiga. Deseja continuar?');
                    if (!confirmChange) { return; }
                    await originalDocRef.delete();
                    const novoIdDaBanca = gerarIdComposto(formData.email, formData.orientador);
                    await db.collection('bancas').doc(novoIdDaBanca).set(
                        {...formData, timestamp: firebase.firestore.FieldValue.serverTimestamp()}
                    );
                    alert('Banca atualizada e migrada para o novo identificador com sucesso!');
                    console.log('Banca atualizada e ID migrado para:', novoIdDaBanca);
                }
            } catch (error) {
                console.error('ERRO AO ATUALIZAR A BANCA: ', error);
                alert('Ocorreu um erro ao atualizar a banca. Verifique o console.');
            }
        } else {
            try {
                const novoIdDaBanca = gerarIdComposto(formData.email, formData.orientador); 
                const existingDoc = await db.collection('bancas').doc(novoIdDaBanca).get();
                if (existingDoc.exists) {
                    alert('Erro: Uma banca com um identificador similar (e-mail e orientador) já foi cadastrada. Se você deseja atualizar uma banca existente, peça para um administrador usar a função de edição.');
                    return;
                }
                await db.collection('bancas').doc(novoIdDaBanca).set(
                    {...formData, timestamp: firebase.firestore.FieldValue.serverTimestamp()}
                ); 
                alert('Banca cadastrada com sucesso!');
                console.log('Dados salvos com sucesso! ID do documento:', novoIdDaBanca);
            } catch (error) {
                console.error('ERRO AO CADASTRAR A BANCA: ', error);
                alert('Ocorreu um erro inesperado ao tentar cadastrar a banca. Por favor, verifique o console do navegador e tente novamente.');
            }
        }

        bancaForm.reset();
        bancaSendoEditadaId = null;
        cadastrarBtn.style.display = 'block';
        atualizarBtn.style.display = 'none';
        
        // Esconde e limpa o campo "Outro" após o envio do formulário
        outroLocalInput.value = '';
        outroLocalDiv.style.display = 'none';
        
        await window.atualizarHorariosDisponiveis();
        await carregarBancasDoFirestore();
    }

    // --- FUNÇÃO DE ATUALIZAÇÃO DO DROPDOWN DE HORÁRIOS ---
    window.atualizarHorariosDisponiveis = async function() {
        const dataParaVerificar = dataInput.value;
        const localRadioSelecionado = document.querySelector('input[name="local"]:checked');
        
        let localParaVerificar = '';

        if (localRadioSelecionado) {
            // AQUI ESTÁ A CHAVE: Visibilidade do campo "Outro" controlada SOMENTE PELO CLIQUE NO RÁDIO
            // Essa função atualizarHorariosDisponiveis não mais define a visibilidade da div.
            // Ela apenas pega o valor correto para a verificação de horários.

            if (localRadioSelecionado.value === 'Outro') {
                localParaVerificar = outroLocalInput.value.trim(); // Pega o valor digitado
            } else {
                localParaVerificar = localRadioSelecionado.value; // Pega o valor do rádio fixo
            }
        }

        horaSelect.innerHTML = '';

        if (!dataParaVerificar || !localParaVerificar) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = 'Selecione um local e data primeiro';
            horaSelect.appendChild(option);
            return;
        }

        const horariosOcupadosNessaDataELocal = agendamentosExistentes
            .filter(agenda => agenda.data === dataParaVerificar && agenda.local === localParaVerificar)
            .map(agenda => agenda.horario);

        const horariosRealmenteDisponiveis = HORARIOS_FIXOS_DISPONIVEIS.filter(horaFixa => {
            return !horariosOcupadosNessaDataELocal.includes(horaFixa);
        });

        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Selecione um horário";
        horaSelect.appendChild(defaultOption);

        if (horariosRealmenteDisponiveis.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Nenhum horário disponível para esta data e local";
            option.disabled = true;
            horaSelect.appendChild(option);
        } else {
            horariosRealmenteDisponiveis.forEach(hora => {
                const option = document.createElement('option');
                option.value = hora;
                option.textContent = hora;
                horaSelect.appendChild(option);
            });
        }
    }

    // --- FUNÇÕES DE AÇÃO (EDITAR E DELETAR) ---
    editarSelecionadoBtn.addEventListener('click', () => {
        if (currentUserRole !== 'admin') {
            alert('Você não tem permissão para editar bancas.');
            return;
        }
        const selectedRadio = document.querySelector('input[name="bancaSelecionada"]:checked');
        if (selectedRadio) {
            preencherFormularioParaEdicao(selectedRadio.value);
        } else {
            alert('Por favor, selecione uma banca para editar.');
        }
    });

    deletarSelecionadoBtn.addEventListener('click', () => {
        if (currentUserRole !== 'admin') {
            alert('Você não tem permissão para deletar bancas.');
            return;
        }
        const selectedRadio = document.querySelector('input[name="bancaSelecionada"]:checked');
        if (selectedRadio) {
            deletarBanca(selectedRadio.value);
        } else {
            alert('Por favor, selecione uma banca para deletar.');
        }
    });

    exportarCsvBtn.addEventListener('click', exportarBancasParaCSV);
    listarBancasBtn.addEventListener('click', carregarBancasDoFirestore);

    // --- CARREGAR BANCAS AO INICIAR A PÁGINA E ATUALIZAR UI ---
    updateUIVisibility();
    // A chamada inicial a atualizarHorariosDisponiveis() ainda é importante para carregar o dropdown.
    atualizarHorariosDisponiveis(); 

    // --- LÓGICA DE VISIBILIDADE DA CAIXA DE TEXTO "OUTRO" LOCAL ---
    // Adicionar event listeners a TODOS os botões de rádio de local
    localRadioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'Outro') {
                outroLocalDiv.style.display = 'block'; // Mostra a caixa de texto
                outroLocalInput.focus(); // Coloca o foco na caixa de texto
            } else {
                outroLocalDiv.style.display = 'none'; // Esconde a caixa de texto
                outroLocalInput.value = ''; // Limpa o valor
                // Ao mudar de "Outro" para um fixo, também atualiza os horários
            }
            atualizarHorariosDisponiveis(); // Sempre chamar para atualizar horários
        });
    });

    // Adicionar event listener para o input de "Outro" local (digitação)
    outroLocalInput.addEventListener('input', atualizarHorariosDisponiveis);

}); // Fim do DOMContentLoaded

// Função para exportar dados para CSV (compatível com Excel)
async function exportarBancasParaCSV() {
    if (currentUserRole !== 'admin') {
        alert('Você não tem permissão para exportar dados.');
        return;
    }

    try {
        const snapshot = await db.collection('bancas').get();
        if (snapshot.empty) {
            alert('Não há bancas cadastradas para exportar.');
            console.log('Nenhuma banca encontrada no Firestore para exportação. Exportação cancelada.');
            return;
        }

        let csvContent = "\uFEFF";
        const headers = [
            "Email", "Tipo de Banca", "Discente", "Orientador", "Coorientador",
            "Título", "Avaliador 1", "Avaliador 2", "Data", "Horário", "Local"
        ];
        csvContent += headers.join(";") + "\n";

        snapshot.forEach(doc => {
            const data = doc.data();
            const rowData = [
                data.email, data.tipoBanca, data.discente, data.orientador,
                data.coorientador || '', data.titulo, data.avaliador1,
                data.avaliador2, data.data, data.horario, data.local
            ].map(item => {
                let value = String(item).replace(/"/g, '""');
                return `"${value}"`;
            });
            csvContent += rowData.join(";") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'bancas_agendadas.xlsx');

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('Dados exportados para planilha (.csv) com sucesso!');
        console.log('Exportação para CSV (compatível com Excel) concluída.');

    } catch (error) {
        console.error('Erro ao exportar dados: ', error);
        alert('Ocorreu um erro ao exportar os dados. Verifique o console.');
    }
}