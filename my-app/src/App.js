// refs:
//   * https://docs.amplify.aws/lib/auth/social/q/platform/js
//   * https://docs.amplify.aws/lib/auth/mfa/q/platform/js

import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import Amplify, { Auth, Hub } from 'aws-amplify';
import QRCode from 'qrcode.react';
import React, { useEffect, useState } from 'react';
import awsConfig from './awsConfig';

Amplify.configure(awsConfig.cognito);

const App = () => {
  const [user, setUser] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    Hub.listen('auth', async ({ payload: { event, data } }) => {
      switch (event) {
        case 'signIn':
        case 'cognitoHostedUI':
          try {
            setUser(
              await Auth.currentAuthenticatedUser({ bypassCache: true })
            );

            setCredentials(
              await Auth.currentCredentials()
            );
          } catch (e) {
            console.log('Not signed in');
          }

          break;
        case 'signOut':
          setUser(null);
          setCredentials(null);

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

  return (
    <div>
      <p>
        User: {user ? user.attributes.email : 'None'}
      </p>

      {user ? (
        qrCode ? (
          <>
            <TotpSetupForm
              qrCode={qrCode}
              setQrCode={setQrCode}
              user={user}
              setUser={setUser}
            />

            <SignOutButton />
          </>
        ) : (
          user.preferredMFA !== 'NOMFA' ? (
            <>
              <S3ObjectList
                credentials={credentials}
              />

              <CancelMfaButton
                user={user}
                setUser={setUser}
              />

              <SignOutButton />
            </>
          ) : (
            <>
              <S3ObjectList
                credentials={credentials}
              />

              <SetupTotpButton
                user={user}
                setQrCode={setQrCode}
              />

              <SignOutButton />
            </>
          )
        )
      ) : (
        <SignInButton />
      )}
    </div >
  );
};

const CancelMfaButton = (props) => {
  const handleClick = async () => {
    await Auth.setPreferredMFA(props.user, 'NOMFA');

    props.setUser(
      await Auth.currentAuthenticatedUser({ bypassCache: true })
    );
  };

  return (
    <button
      onClick={() => {
        handleClick();
      }}
    >
      Cancel MFA
    </button>
  );
};

const SetupTotpButton = (props) => {
  const setupTotp = async () => {
    const code = await Auth.setupTOTP(props.user);

    props.setQrCode(
      `otpauth://totp/AWSCognito:${props.user.username}?secret=${code}&issuer=${encodeURI('AWSCognito')}`
    );
  };

  return (
    <button
      onClick={() => {
        setupTotp();
      }}
    >
      Setup TOTP
    </button>
  );
};

const SignOutButton = () => {
  return (
    <button
      onClick={() => {
        Auth.signOut();
      }}
    >
      Sign Out
    </button>
  );
};

const SignInButton = () => {
  return (
    <button
      onClick={() => {
        Auth.federatedSignIn();
      }}
    >
      Federated Sign In
    </button>
  );
};

const S3ObjectList = (props) => {
  const [objects, setObjects] = useState([]);

  useEffect(() => {
    const fetchObjectList = async () => {
      const client = new S3Client({
        region: awsConfig.s3.region,
        credentials: props.credentials
      });

      const command = new ListObjectsV2Command({
        Bucket: awsConfig.s3.bucket
      });

      const response = await client.send(command);

      setObjects(
        response.Contents.map((obj) => {
          return obj.Key;
        })
      );
    };

    if (props.credentials) {
      fetchObjectList();
    }
  }, [
    props.credentials
  ]);

  return (
    <>
      <p>
        Objects:
      </p>

      {props.credentials ? (
        <ul>
          {objects.map(obj => {
            return (
              <li
                key={obj}
              >
                {obj}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>
          Not authorized...
        </p>
      )}
    </>
  );
};

const TotpSetupForm = (props) => {
  const [oneTimePassword, setOneTimePassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await Auth.verifyTotpToken(props.user, oneTimePassword);

      await Auth.setPreferredMFA(props.user, 'TOTP');

      props.setUser(
        await Auth.currentAuthenticatedUser({ bypassCache: true })
      );

      props.setQrCode(null);
    } catch (e) {
      console.log(e);
    }
  };

  const handleChange = (event) => {
    setOneTimePassword(event.target.value);
  };

  return (
    <>
      <h2>
        Verify TOTP
      </h2>

      <QRCode
        value={props.qrCode}
      />

      <form
        onSubmit={handleSubmit}
      >
        <label>
          One-time password:

          <input
            type='text'
            value={oneTimePassword}
            onChange={handleChange}
          />
        </label>

        <input
          type='submit'
          value='Verify'
        />
      </form>
    </>
  );
};

export default App;
