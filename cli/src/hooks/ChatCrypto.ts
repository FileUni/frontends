//! Frontend encryption utility

//! Frontend encryption utility
import CryptoJS from 'crypto-js';

export class ChatCrypto {
  /**
   * Check if it is encrypted text
   * CryptoJS AES output typically starts with 'U2FsdGVkX1' (Salted__)
   */
  static isEncrypted(text: string): boolean {
    return typeof text === 'string' && text.startsWith('U2FsdGVkX1');
  }

  /**
   * Encrypt text
   * Use AES-256-CBC to ensure availability in insecure contexts (e.g. LAN HTTP)
   */
  static async encrypt(text: string, password: string): Promise<string> {
    if (!password || !text) return text;
    try {
      // CryptoJS automatically performs Key derivation (EVPKDF) and IV generation
      return CryptoJS.AES.encrypt(text, password).toString();
    } catch (e) {
      console.error("[ChatCrypto] Encryption error:", e);
      return text;
    }
  }

  /**
   * Decrypt text
   */
  static async decrypt(ciphertext: string, password: string): Promise<string> {
    if (!password || !ciphertext) return ciphertext;
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, password);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      if (!plaintext) {
        // If decryption result is empty, password may be wrong or content was already plaintext
        return ciphertext;
      }
      return plaintext;
    } catch (e) {
      // Return original on failure
      return ciphertext;
    }
  }
}


