export const USER_MESSAGES = Object.freeze({
  unexpected: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
  chatPlataformaUnavailable:
    'Não conseguimos falar com o Chat Plataforma agora. Tente novamente em instantes.',
  chatPlataformaBusy:
    'O Chat Plataforma está recebendo muitas solicitações. Tente novamente em alguns segundos.',
  chatPlataformaRejected:
    'O Chat Plataforma não aceitou esta ação. Revise os dados e tente novamente.',
  integrationNeedsReconfiguration:
    'A integração precisa ser reconfigurada. Avise o administrador da sua empresa.',
  integrationMissingPermission:
    'A integração não tem permissão para esta ação. Avise o administrador da sua empresa.',
  installationNotFound:
    'Este aplicativo não está mais instalado na sua empresa. Avise o administrador.',
  invalidRequest: 'Não foi possível processar os dados enviados. Revise e tente novamente.',
} as const)

export const ADMIN_MESSAGES = Object.freeze({
  untrustedCall:
    'Não foi possível confirmar que a chamada veio do Chat Plataforma. Avise o suporte do aplicativo.',
  installationNotFound:
    'Esta instalação não existe mais no aplicativo. Exclua o aplicativo e instale novamente.',
  invalidRequest:
    'O aplicativo recebeu dados que não reconhece. Tente novamente ou avise o suporte do aplicativo.',
  invalidCredentials: 'As credenciais informadas são inválidas.',
  invalidApiKey:
    'A API Key do Chat Plataforma não foi aceita. Gere uma nova chave em Configurações > API e tente novamente.',
  apiKeyBlocked:
    'O Chat Plataforma recusou a API Key: a conta ou o usuário que criou a chave está inativo. Gere uma nova chave com um usuário ativo.',
  chatPlataformaUnavailable:
    'Não foi possível validar a API Key agora porque o Chat Plataforma não respondeu. Tente novamente em instantes.',
  routeNotFound: 'Recurso não encontrado no aplicativo.',
} as const)

export const missingPermissionsMessage = (permissions: readonly string[]) =>
  `A API Key não tem as permissões necessárias (${permissions.join(', ')}). Use uma chave criada por um proprietário da conta ou ajuste o perfil de quem a criou.`
