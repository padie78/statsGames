export const environment = {
  production: false,
  appsync: {
    endpoint: 'https://fjfiyg5qmrdwdiga4ru2g2ut7m.appsync-api.eu-central-1.amazonaws.com/graphql',
    region: 'eu-central-1',
    apiKey: 'da2-el3nlzvq2nawxcgx7nqcdw6kaa',
  },
  cognito: {
    userPoolId: 'eu-central-1_80z3lWnpT',
    userPoolClientId: '32htrhmdetl2a2rmqi3hba5gb0',
    domain: 'stats-games-dev',
    oauthRedirectSignIn: 'http://localhost:4200/auth/callback',
    oauthRedirectSignOut: 'http://localhost:4200/login',
  },
  webhookUrlPattern:
    'https://xr1lip3ln0.execute-api.eu-central-1.amazonaws.com/webhooks/{platform}',
  mediaProxyBaseUrl: 'https://xr1lip3ln0.execute-api.eu-central-1.amazonaws.com',
  /**
   * Valorant: perfiles privados por defecto. RSO = permiso explícito del jugador.
   * Cuando haya client_id Riot, completar `rsoAuthorizeUrl` (authorize endpoint).
   */
  riot: {
    rsoAuthorizeUrl: '' as string,
    accountUrl: 'https://account.riotgames.com/',
    valorantPrivacyHelpUrl:
      'https://support-valorant.riotgames.com/hc/en-us/articles/360047241634',
  },
};
