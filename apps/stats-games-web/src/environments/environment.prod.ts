export const environment = {
  production: true,
  appsync: {
    endpoint: 'https://REPLACE.appsync-api.eu-central-1.amazonaws.com/graphql',
    region: 'eu-central-1',
    apiKey: 'REPLACE_API_KEY',
  },
  cognito: {
    userPoolId: 'eu-central-1_REPLACE',
    userPoolClientId: 'REPLACE_CLIENT_ID',
    domain: 'REPLACE_COGNITO_DOMAIN',
    oauthRedirectSignIn: 'https://REPLACE.cloudfront.net/auth/callback',
    oauthRedirectSignOut: 'https://REPLACE.cloudfront.net/login',
  },
  webhookUrlPattern:
    'https://REPLACE.execute-api.eu-central-1.amazonaws.com/webhooks/{platform}',
  /** Mismo host que webhook_api_endpoint (sin /webhooks). */
  mediaProxyBaseUrl: 'https://REPLACE.execute-api.eu-central-1.amazonaws.com',
  riot: {
    clientId: '' as string,
    redirectUri: 'https://REPLACE.cloudfront.net/integrations/riot/callback',
    authorizeUrl: 'https://auth.riotgames.com/authorize',
    scopes: 'openid offline_access',
    tokenExchangeUrl:
      'https://REPLACE.execute-api.eu-central-1.amazonaws.com/integrations/riot/rso/exchange',
    accountUrl: 'https://account.riotgames.com/',
    valorantPrivacyHelpUrl:
      'https://support-valorant.riotgames.com/hc/en-us/articles/360047241634',
  },
};
