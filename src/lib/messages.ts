export const APP_MESSAGES = {
  credentialsInvalid: {
    title: 'Credenciais inválidas',
    body: 'E-mail ou senha não conferem. Verifique os dados ou use uma conta de teste.',
  },
  wrongRole: {
    title: 'Acesso incompatível',
    body: 'Esta conta pertence ao outro tipo de usuário. Volte e escolha Cliente ou Transportador.',
  },
  emailTaken: {
    title: 'E-mail já cadastrado',
    body: 'Tente entrar com essa conta ou use outro e-mail.',
  },
  emailNotFound: {
    title: 'E-mail não encontrado',
    body: 'Não há conta com esse e-mail. Confira a digitação ou cadastre-se.',
  },
  invalidCode: {
    title: 'Código inválido',
    body: 'O código informado não confere. Confira o e-mail ou solicite outro.',
  },
  recoveryExpired: {
    title: 'Recuperação expirada',
    body: 'Solicite um novo código para alterar a senha.',
  },
  genericError: {
    title: 'Algo deu errado',
    body: 'Tente novamente em instantes.',
  },
  accountCreated: {
    title: 'Conta criada',
    body: 'Conta criada com sucesso!',
  },
  codeSent: {
    title: 'Código enviado',
    body: 'Código enviado em seu e-mail.',
  },
  passwordChanged: {
    title: 'Senha alterada',
    body: 'Senha alterada com sucesso!',
  },
  routeCreated: {
    title: 'Rota criada',
    body: 'Rota criada com sucesso!',
  },
  profileUpdated: {
    title: 'Perfil atualizado',
    body: 'Suas informações foram salvas.',
  },
  groupCreated: {
    title: 'Grupo criado',
    body: 'Agora adicione os alunos. Depois vincule o grupo ao criar a rota.',
  },
  memberAdded: {
    title: 'Aluno adicionado',
    body: 'O aluno foi vinculado ao grupo.',
  },
} as const;

export type AppMessageKey = keyof typeof APP_MESSAGES;
export type AppMessageKind = 'error' | 'success' | 'info';
