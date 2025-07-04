// --- VARIÁVEL GLOBAL: agendamentosExistentes ---
let agendamentosExistentes = []; // DECLARE AQUI, FORA DE QUALQUER FUNÇÃO OU LISTENER; Armazenará todos os agendamentos do banco

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
    // --- FIM DA VERIFICAÇÃO DE CONEXÃO ---

    // Elementos do DOM
    const dataInput = document.getElementById('data'); // O input type="date"
    const horaSelect = document.getElementById('hora');
    const bancasTableBody = document.querySelector('#bancasTable tbody');
    const listarBancasBtn = document.getElementById('listarBancasBtn');
    const cadastrarBtn = document.getElementById('cadastrarBtn'); // Agora type="button"
    const atualizarBtn = document.getElementById('atualizarBtn');
    const bancaForm = document.getElementById('bancaForm');
    const bancasContagemParagrafo = document.getElementById('bancasContagem');
    const editarSelecionadoBtn = document.getElementById('editarSelecionadoBtn');
    const deletarSelecionadoBtn = document.getElementById('deletarSelecionadoBtn');
    const localRadioButtons = document.querySelectorAll('input[name="local"]'); // Captura todos os radios de local
    const exportarCsvBtn = document.getElementById('exportarCsvBtn'); // Pega o botão de exportar

    let bancaSendoEditadaId = null; // Armazena o ID da banca que está sendo editada

    const HORARIOS_FIXOS_DISPONIVEIS = [
        "07:30", "09:00", "10:30", "13:30", "15:00", "16:30"
    ];

    // Adicione este listener:
    if (exportarCsvBtn) {
        exportarCsvBtn.addEventListener('click', exportarBancasParaCSV);
    }

    atualizarBtn.style.display = 'none'; // Esconde o botão atualizar inicialmente

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
            bancasTableBody.innerHTML = '<tr><td colspan="6">Nenhuma banca cadastrada.</td></tr>'; 
            return;
        }

        agendamentosExistentes.forEach(banca => {
            const row = bancasTableBody.insertRow();
            row.id = `banca-${banca.id}`; 
            row.innerHTML = `
                <td>
                    <input type="radio" name="bancaSelecionada" value="${banca.id}">
                </td>
                <td>${banca.data || ''}</td>
                <td>${banca.horario || ''}</td>
                <td>${banca.local || ''}</td>
                <td>${banca.orientador || ''}</td>
                <td>${banca.discente || ''}</td>
            `;
        });

        // Os event listeners para rádio já serão tratados pelos botões 'Selecionado'
    }

    // --- FUNÇÕES DE AÇÃO (EDITAR E DELETAR) ---

    async function preencherFormularioParaEdicao(id) {
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
            
            // Preenche a data e o local
            dataInput.value = banca.data || ''; 
            const localRadio = document.querySelector(`input[name="local"][value="${banca.local}"]`);
            if (localRadio) localRadio.checked = true; // Seleciona o rádio do local

            // Chama atualizarHorariosDisponiveis com a data E o local da banca original
            await atualizarHorariosDisponiveis(); // Agora a função pega data e local dos inputs
            document.getElementById('hora').value = banca.horario || ''; // Seleciona o horário

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

    // Listener para o botão CADASTRAR (agora type="button")
    cadastrarBtn.addEventListener('click', async (e) => {
        handleFormSubmission();
    });

    // Listener para o botão ATUALIZAR (type="button")
    atualizarBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 

        if (!bancaSendoEditadaId) {
            alert('Nenhuma banca selecionada para atualização.');
            return;
        }

        await handleFormSubmission(true);
    });


       // --- LÓGICA DE ENVIO/ATUALIZAÇÃO DO FORMULÁRIO (Função principal) ---
    async function handleFormSubmission(isUpdate = false) {
        // --- VALIDAÇÃO E CAPTURA DE DADOS DO FORMULÁRIO (Unificado aqui) ---
        // Garante que campos obrigatórios estejam preenchidos
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

        if (!formularioValido) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            console.error('ERRO: Formulário não preenchido completamente ou com erros.');
            return;
        }
        // --- FIM DA VALIDAÇÃO INICIAL ---

        // CAPTURA DOS DADOS (AGORA DENTRO DO ESCOPO DA FUNÇÃO)
        const formData = {
            email: document.getElementById('email').value.trim(),
            tipoBanca: tipoBancaChecked.value,
            discente: document.getElementById('discente').value.trim(),
            orientador: document.getElementById('orientador').value.trim(),
            coorientador: document.getElementById('coorientador').value.trim() || null, // Garante que seja null se vazio
            titulo: document.getElementById('titulo').value.trim(),
            avaliador1: document.getElementById('avaliador1').value.trim(),
            avaliador2: document.getElementById('avaliador2').value.trim(),
            data: document.getElementById('data').value,
            horario: document.getElementById('hora').value,
            local: localChecked.value
        };

        // Validação extra para data/horario/local (agora usando formData)
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

        // INÍCIO DA VERIFICAÇÃO DE DUPLICIDADE (Reutiliza a lógica)
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

        // Lógica de SALVAR ou ATUALIZAR
        if (isUpdate) {
            // Lógica de ATUALIZAÇÃO
            try {
                const originalDocRef = db.collection('bancas').doc(bancaSendoEditadaId);
                const originalDoc = await originalDocRef.get();
                if (!originalDoc.exists) {
                    alert('Erro: Banca original não encontrada para atualização.');
                    return;
                }
                const originalData = originalDoc.data();

                if (originalData.email === formData.email) {
                    // E-mail NÃO mudou: Atualiza o documento existente
                    await originalDocRef.update(formData); // Use update para atualizar apenas os campos fornecidos
                    alert('Banca atualizada com sucesso!');
                } else {
                    // E-mail MUDOU: Deleta o antigo e cria um novo com o novo e-mail como ID
                    const confirmChange = confirm('O e-mail foi alterado. Isso irá criar uma nova banca com o novo e-mail como identificador e remover a banca antiga. Deseja continuar?');
                    if (!confirmChange) {
                        return;
                    }
                    await originalDocRef.delete();
                    await db.collection('bancas').doc(formData.email).set(formData);
                    alert('Banca atualizada e migrada para o novo e-mail com sucesso!');
                }
            } catch (error) {
                console.error('ERRO AO ATUALIZAR A BANCA: ', error);
                alert('Ocorreu um erro ao atualizar a banca. Verifique o console.');
            }
        } else {
            // Lógica de CADASTRO
            try {
                // Usa o e-mail como o ID do documento
                await db.collection('bancas').doc(formData.email).set(formData);
                alert('Banca cadastrada com sucesso!');
                console.log(`Banca cadastrada com ID: ${formData.email}`);
            } catch (error) {
                console.error('ERRO AO CADASTRAR A BANCA: ', error);
                alert('Ocorreu um erro inesperado ao tentar cadastrar a banca. Por favor, verifique o console do navegador e tente novamente.');
            }
        }

        // Ações pós-sucesso (Cadastro ou Atualização)
        bancaForm.reset();
        bancaSendoEditadaId = null;
        cadastrarBtn.style.display = 'block';
        atualizarBtn.style.display = 'none';
        await window.atualizarHorariosDisponiveis(); // Limpa dropdown e atualiza conforme a nova seleção (data e local)
        await carregarBancasDoFirestore(); // Recarrega a tabela e contadores
    }


    // --- FUNÇÃO DE ATUALIZAÇÃO DO DROPDOWN DE HORÁRIOS ---
    // Esta função agora é chamada quando a data OU o local são alterados
    window.atualizarHorariosDisponiveis = async function() { 
        const dataParaVerificar = dataInput.value;
        const localRadioSelecionado = document.querySelector('input[name="local"]:checked'); // Pega o local selecionado
        const localParaVerificar = localRadioSelecionado ? localRadioSelecionado.value : '';

        horaSelect.innerHTML = ''; // Limpa opções existentes

        // Condição para exibir a mensagem inicial no dropdown
        if (!dataParaVerificar || !localParaVerificar) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = 'Selecione um local e data primeiro'; // Texto alterado
            horaSelect.appendChild(option);
            return;
        }

        // Filtra os agendamentos existentes PARA AQUELE DIA E LOCAL ESPECÍFICO
        const horariosOcupadosNessaDataELocal = agendamentosExistentes
            .filter(agenda => agenda.data === dataParaVerificar && agenda.local === localParaVerificar)
            .map(agenda => agenda.horario);

        // Filtra os horários fixos para mostrar apenas os que não estão ocupados
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
            option.textContent = "Nenhum horário disponível para esta data e local"; // Texto específico
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


    // --- EVENT LISTENERS PARA OS BOTÕES NA TABELA ---
    editarSelecionadoBtn.addEventListener('click', () => {
        const selectedRadio = document.querySelector('input[name="bancaSelecionada"]:checked');
        if (selectedRadio) {
            preencherFormularioParaEdicao(selectedRadio.value);
        } else {
            alert('Por favor, selecione uma banca para editar.');
        }
    });

    deletarSelecionadoBtn.addEventListener('click', () => {
        const selectedRadio = document.querySelector('input[name="bancaSelecionada"]:checked');
        if (selectedRadio) {
            deletarBanca(selectedRadio.value);
        } else {
            alert('Por favor, selecione uma banca para deletar.');
        }
    });


    // --- EVENT LISTENER PARA O BOTÃO DE ATUALIZAR LISTA DE BANCAS ---
    listarBancasBtn.addEventListener('click', carregarBancasDoFirestore);

    // --- CARREGAR BANCAS AO INICIAR A PÁGINA ---
    carregarBancasDoFirestore();

    // Chamada inicial para preencher os horários disponíveis
    // (Pode precisar de uma seleção de local e data inicial para ter efeito)
    atualizarHorariosDisponiveis();

    // Adicionar event listeners para os botões de rádio do local
    localRadioButtons.forEach(radio => {
        radio.addEventListener('change', atualizarHorariosDisponiveis);
    });

}); // Fim do DOMContentLoaded

// Função para exportar dados para CSV (compatível com Excel)
async function exportarBancasParaCSV() {
    try {
        const snapshot = await db.collection('bancas').get(); // Busca todos os documentos do Firestore

        if (snapshot.empty) {
            alert('Não há bancas cadastradas para exportar.');
            console.log('Nenhuma banca encontrada no Firestore para exportação. Exportação cancelada.');
            return;
        }

        // Adiciona o Byte Order Mark (BOM) para UTF-8. Isso ajuda o Excel a reconhecer a codificação.
        let csvContent = "\uFEFF"; 

        // Define os cabeçalhos das colunas, usando PONTO E VÍRGULA como delimitador.
        const headers = [
            "Email", "Tipo de Banca", "Discente", "Orientador", "Coorientador", 
            "Título", "Avaliador 1", "Avaliador 2", "Data", "Horário", "Local"
        ];
        csvContent += headers.join(";") + "\n"; // Une os cabeçalhos com ; e adiciona uma quebra de linha

        snapshot.forEach(doc => {
            const data = doc.data(); // Obtém os dados de cada documento

            // Array na ordem dos cabeçalhos para cada linha da planilha.
            // Cada item é tratado para ser seguro no CSV:
            // 1. Converte para String.
            // 2. Substitui aspas internas (") por duas aspas ("") para escapá-las.
            // 3. Envolve o valor resultante em aspas duplas ("...") para que vírgulas, pontos e vírgulas ou quebras de linha dentro do valor não quebrem as colunas.
            const rowData = [
                data.email,
                data.tipoBanca,
                data.discente,
                data.orientador,
                data.coorientador || '', // Usa string vazia se coorientador for null/undefined
                data.titulo,
                data.avaliador1,
                data.avaliador2,
                data.data,
                data.horario,
                data.local
            ].map(item => {
                // Garante que o valor é uma string e escapa aspas duplas dentro dela
                let value = String(item).replace(/"/g, '""');
                return `"${value}"`; // Envolve o valor escapado em aspas duplas
            });

            csvContent += rowData.join(";") + "\n"; // Une os valores da linha com ; e adiciona quebra de linha
        });

        // Cria um objeto Blob (Binary Large Object) com o conteúdo CSV
        // O tipo MIME 'text/csv;charset=utf-8;' é importante para o navegador
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Cria um link temporário (elemento <a>) para iniciar o download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); // Cria uma URL temporária para o Blob
        link.setAttribute('download', 'bancas_agendadas.xlsx'); // Define o nome do arquivo com a extensão .csv

        // Adiciona o link ao corpo do documento, simula um clique e depois o remove.
        // Isso força o download do arquivo.
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