import { Amplify } from 'aws-amplify';

export interface AppEnvironment {
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
}

export function configureAmplify(env: AppEnvironment): void {
  const oauthDomain = env.cognito.domain;
  const redirectSignIn = env.cognito.oauthRedirectSignIn ?? `${window.location.origin}/auth/callback`;
  const redirectSignOut = env.cognito.oauthRedirectSignOut ?? `${window.location.origin}/login`;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.cognito.userPoolId,
        userPoolClientId: env.cognito.userPoolClientId,
        loginWith: {
          email: true,
          oauth: oauthDomain
            ? {
                domain: oauthDomain,
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [redirectSignIn],
                redirectSignOut: [redirectSignOut],
                responseType: 'code',
              }
            : undefined,
        },
        signUpVerificationMethod: 'code',
      },
    },
    API: {
      GraphQL: {
        endpoint: env.appsync.endpoint,
        region: env.appsync.region,
        defaultAuthMode: 'apiKey',
        apiKey: env.appsync.apiKey,
      },
    },
  });
}
