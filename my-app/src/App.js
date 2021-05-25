// ref: https://docs.amplify.aws/lib/auth/social/q/platform/js

import Amplify, { Auth, Hub } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import './App.css';
import awsConfig from './awsConfig';

Amplify.configure(awsConfig);

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    Hub.listen('auth', ({ payload: { event, data } }) => {
      switch (event) {
        case 'signIn':
        case 'cognitoHostedUI':
          getUser().then(userData => {
            setUser(userData);
          });

          break;
        case 'signOut':
          setUser(null);

          break;
        case 'signIn_failure':
        case 'cognitoHostedUI_failure':
          console.log('Sign in failure', data);

          break;
        default:
          break;
      }
    });
  }, []);

  const getUser = () => {
    return Auth.currentAuthenticatedUser().then(userData => {
      return userData;
    }).catch(() => {
      console.log('Not signed in');
    });
  };

  return (
    <div className='App'>
      <p>
        User: {user ? JSON.stringify(user.attributes) : 'None'}
      </p>

      {user ? (
        <button onClick={() => {
          Auth.signOut();
        }}>
          Sign Out
        </button>
      ) : (
        <button onClick={() => {
          Auth.federatedSignIn();
        }}>
          Federated Sign In
        </button>
      )}
    </div>
  );
};

export default App;
