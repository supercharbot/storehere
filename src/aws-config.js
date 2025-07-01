import { Amplify } from 'aws-amplify';

const awsconfig = {
  Auth: {
    Cognito: {
      region: process.env.REACT_APP_AWS_REGION,
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID,
      loginWith: {
        email: true,
        username: true
      }
    }
  }
};

Amplify.configure(awsconfig);

export default awsconfig;