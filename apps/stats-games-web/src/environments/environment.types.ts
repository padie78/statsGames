/** Shape compartido entre environment.ts y environment.prod.ts (y el inject de CI). */
export interface AppRuntimeEnvironment {
  production: boolean;
  appsync: {
    endpoint: string;
    region: string;
    apiKey: string;
  };
  cognito: {
    userPoolId: string;
    userPoolClientId: string;
    domain?: string;
    oauthRedirectSignIn?: string;
    oauthRedirectSignOut?: string;
  };
  webhookUrlPattern: string;
  mediaProxyBaseUrl: string;
  riot: {
    clientId: string;
    redirectUri: string;
    authorizeUrl: string;
    scopes: string;
    tokenExchangeUrl: string;
    accountUrl: string;
    valorantPrivacyHelpUrl: string;
  };
}
