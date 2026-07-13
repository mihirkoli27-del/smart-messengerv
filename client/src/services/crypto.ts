// End-to-End Encryption (E2EE) services using the browser's native Web Crypto API.
// RSA-OAEP (2048-bit) is used for secure key exchange.
// AES-GCM (256-bit) is used for message encryption/decryption.

// Generate a new RSA-OAEP key pair for E2EE
export const generateE2EEKeys = async (): Promise<CryptoKeyPair> => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // Extractable
    ['encrypt', 'decrypt']
  );
};

// Export the public key to JWK (JSON Web Key) format for uploading to the server
export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(exported);
};

// Export the private key to JWK format (for saving in local IndexedDB)
export const exportPrivateKey = async (privateKey: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey('jwk', privateKey);
  return JSON.stringify(exported);
};

// Import a public key from JWK format
export const importPublicKey = async (jwkString: string): Promise<CryptoKey> => {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
};

// Import a private key from JWK format
export const importPrivateKey = async (jwkString: string): Promise<CryptoKey> => {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
};

// Helper: Convert ArrayBuffer to Base64 String
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper: Convert Base64 String to ArrayBuffer
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

interface EncryptionResult {
  encryptedContent: string;
  iv: string;
  encryptedKeys: { [userId: string]: string };
}

// Encrypt a message using a random symmetric key (AES-GCM), then encrypt the symmetric key with public keys
export const encryptMessage = async (
  content: string,
  recipients: Array<{ userId: string; publicKeyJwk: string }>,
  sender: { userId: string; publicKey: CryptoKey }
): Promise<EncryptionResult> => {
  // 1. Generate a random AES-GCM 256-bit symmetric key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt the plain text content using the AES key
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV is standard for AES-GCM
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    encoder.encode(content)
  );

  const encryptedContent = arrayBufferToBase64(encryptedBuffer);
  const ivBase64 = arrayBufferToBase64(iv);

  // 3. Export the AES key raw bytes so it can be encrypted using RSA public keys
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 4. Encrypt the raw AES key for each recipient
  const encryptedKeys: { [userId: string]: string } = {};

  for (const rc of recipients) {
    try {
      const pubKey = await importPublicKey(rc.publicKeyJwk);
      const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        pubKey,
        rawAesKey
      );
      encryptedKeys[rc.userId] = arrayBufferToBase64(encryptedKeyBuffer);
    } catch (err) {
      console.error(`Failed to encrypt AES key for recipient ${rc.userId}:`, err);
    }
  }

  // 5. Also encrypt the raw AES key for the sender so the sender can view their own chat history
  try {
    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      sender.publicKey,
      rawAesKey
    );
    encryptedKeys[sender.userId] = arrayBufferToBase64(encryptedKeyBuffer);
  } catch (err) {
    console.error(`Failed to encrypt AES key for sender:`, err);
  }

  return {
    encryptedContent,
    iv: ivBase64,
    encryptedKeys,
  };
};

// Decrypt a message using our private key
export const decryptMessage = async (
  encryptedContent: string,
  iv: string,
  encryptedKeyForMe: string,
  myPrivateKey: CryptoKey
): Promise<string> => {
  try {
    // 1. Decrypt the AES raw symmetric key using our private RSA key
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyForMe);
    const rawAesKeyBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      myPrivateKey,
      encryptedKeyBuffer
    );

    // 2. Re-import the raw AES key
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawAesKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['decrypt']
    );

    // 3. Decrypt the message content using the AES key
    const contentBuffer = base64ToArrayBuffer(encryptedContent);
    const ivBuffer = base64ToArrayBuffer(iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer),
      },
      aesKey,
      contentBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error('Failed to decrypt message:', err);
    throw new Error('Decryption failed: key mismatch or corrupted data');
  }
};
