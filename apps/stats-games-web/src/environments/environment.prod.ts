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
};
