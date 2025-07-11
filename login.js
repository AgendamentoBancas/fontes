document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        errorMessage.textContent = ''; // Limpa qualquer mensagem de erro anterior

        if (!email || !password) {
            errorMessage.textContent = 'Por favor, preencha seu e-mail e senha.';
            return;
        }

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('Usuário logado:', user.email);

            // Verifica a role do usuário na coleção 'usuarios'
            const userDoc = await db.collection('usuarios').doc(user.uid).get(); 
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.role === 'admin') {
                    window.location.href = 'index.html';
                } else {
                    errorMessage.textContent = 'Acesso negado: Somente administradores podem acessar esta área.';
                    await auth.signOut(); 
                }
            } else {
                errorMessage.textContent = 'Erro: Seu perfil de usuário não foi encontrado. Contate o administrador do sistema.';
                await auth.signOut();
            }

        } catch (error) {
            console.error('Erro de login:', error);
            let userMessage = 'Erro desconhecido. Por favor, tente novamente.'; 

            // Mapeia códigos de erro do Firebase para mensagens amigáveis
            switch (error.code) {
                case 'auth/invalid-email':
                    userMessage = 'O formato do **e-mail** é inválido. Verifique e tente novamente.';
                    break;
                case 'auth/user-disabled':
                    userMessage = 'Esta conta foi desativada. Contate o administrador.';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password': // Firebase pode retornar este ou o genérico
                    userMessage = '**E-mail ou senha** incorretos. Por favor, verifique suas credenciais e tente novamente.';
                    break;
                case 'auth/invalid-credential': // Captura o erro mais genérico do Firebase Auth
                    userMessage = '**E-mail ou senha** incorretos. Por favor, verifique suas credenciais e tente novamente.';
                    break;
                case 'auth/too-many-requests':
                    userMessage = 'Muitas tentativas de login falhas. Sua conta foi temporariamente bloqueada por segurança. Tente novamente mais tarde.';
                    break;
                case 'auth/network-request-failed':
                    userMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
                    break;
                default:
                    // Verifica se a mensagem técnica contém a frase de credenciais inválidas
                    if (error.message && error.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                        userMessage = '**E-mail ou senha** incorretos. Por favor, verifique suas credenciais e tente novamente.';
                    } else {
                        userMessage = `Erro: ${error.message}`; // Fallback para outros erros não mapeados
                    }
                    break;
            }
            errorMessage.textContent = userMessage;
        }
    });
});