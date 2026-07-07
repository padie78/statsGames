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
  };
}

export function configureAmplify(env: AppEnvironment): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.cognito.userPoolId,
        userPoolClientId: env.cognito.userPoolClientId,
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
