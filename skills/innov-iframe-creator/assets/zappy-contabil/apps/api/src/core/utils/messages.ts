export const USER_MESSAGES = Object.freeze({
  unexpected: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
  zappyUnavailable: 'Não conseguimos falar com a Zappy agora. Tente novamente em instantes.',
  zappyNeedsReconfiguration:
    'A conexão da sua empresa com a Zappy precisa ser refeita. Avise o administrador.',
  ticketNotFound: 'Não encontramos este atendimento.',
  tenantNotFound: 'Esta empresa não está cadastrada no aplicativo. Avise o administrador.',
  tenantInactive: 'O acesso da sua empresa ao aplicativo está desativado. Avise o administrador.',
  missingTenantContext:
    'Não foi possível identificar a empresa e o usuário. Abra o app pela Zappy.',
  invalidRequest: 'Não foi possível processar os dados enviados. Revise e tente novamente.',
} as const)

export const ADMIN_MESSAGES = Object.freeze({
  invalidRequest:
    'O aplicativo recebeu dados que não reconhece. Tente novamente ou avise o suporte do aplicativo.',
  routeNotFound: 'Recurso não encontrado no aplicativo.',
  unauthorizedOperation: 'Chave de operação ausente ou inválida.',
  tenantNotFound: 'Empresa não encontrada.',
  tenantUrlTaken: 'Já existe uma empresa cadastrada com esta URL da Zappy.',
  tenantInvalidUrl:
    'A URL ou o token da Zappy não têm o formato esperado. Use https://api-<empresa>.zapcontabil.chat e o token de API da instância.',
  tenantInvalidCredentials:
    'A Zappy recusou o token de API. Gere um novo token na instância e tente novamente.',
  tenantInstanceDown:
    'Não foi possível validar o token agora porque a instância da Zappy não respondeu. Tente novamente em instantes.',
} as const)
