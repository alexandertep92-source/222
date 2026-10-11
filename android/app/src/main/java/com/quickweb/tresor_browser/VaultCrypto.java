package com.quickweb.tresor_browser;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Streaming AES-256-GCM in the vault file format ("TRV1"), see
 * lib/core/vault_format.dart for the layout. Plain Java so it can be tested on
 * a desktop JVM.
 */
public final class VaultCrypto {
    public static final int HEADER_LENGTH = 16;
    public static final int TAG_LENGTH = 16;
    public static final int PREFIX_LENGTH = 7;
    public static final int DEFAULT_CHUNK_SIZE = 1 << 20;
    private static final int MIN_CHUNK_SIZE = 1 << 10;
    private static final int MAX_CHUNK_SIZE = 1 << 24;
    private static final byte[] MAGIC = {'T', 'R', 'V', '1'};
    private static final SecureRandom RANDOM = new SecureRandom();

    /** The data does not decrypt with this key or was modified. */
    public static final class AuthenticationException extends GeneralSecurityException {
        AuthenticationException() {
            super("authentication failed");
        }
    }

    /** The data is not in the vault format. */
    public static final class FormatException extends IOException {
        FormatException(String message) {
            super(message);
        }
    }

    private VaultCrypto() {}

    static byte[] nonce(byte[] prefix, int index, boolean last) {
        byte[] nonce = new byte[12];
        System.arraycopy(prefix, 0, nonce, 0, PREFIX_LENGTH);
        nonce[7] = (byte) (last ? 1 : 0);
        nonce[8] = (byte) (index >>> 24);
        nonce[9] = (byte) (index >>> 16);
        nonce[10] = (byte) (index >>> 8);
        nonce[11] = (byte) index;
        return nonce;
    }

    /** Reads until [buffer] is full or the stream ends. Returns the bytes read. */
    private static int readFully(InputStream in, byte[] buffer) throws IOException {
        int total = 0;
        while (total < buffer.length) {
            int read = in.read(buffer, total, buffer.length - total);
            if (read < 0) break;
            total += read;
        }
        return total;
    }

    private static Cipher cipher(int mode, SecretKeySpec key, byte[] prefix, int index, boolean last)
            throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, key, new GCMParameterSpec(TAG_LENGTH * 8, nonce(prefix, index, last)));
        return cipher;
    }

    /** Encrypts [in] into [out]. Returns the number of plaintext bytes. */
    public static long encrypt(InputStream in, OutputStream out, byte[] key)
            throws IOException, GeneralSecurityException {
        return encrypt(in, out, key, DEFAULT_CHUNK_SIZE);
    }

    static long encrypt(InputStream in, OutputStream out, byte[] key, int chunkSize)
            throws IOException, GeneralSecurityException {
        SecretKeySpec spec = new SecretKeySpec(key, "AES");
        byte[] prefix = new byte[PREFIX_LENGTH];
        RANDOM.nextBytes(prefix);

        byte[] header = new byte[HEADER_LENGTH];
        System.arraycopy(MAGIC, 0, header, 0, 4);
        header[4] = (byte) (chunkSize >>> 24);
        header[5] = (byte) (chunkSize >>> 16);
        header[6] = (byte) (chunkSize >>> 8);
        header[7] = (byte) chunkSize;
        System.arraycopy(prefix, 0, header, 8, PREFIX_LENGTH);
        out.write(header);

        byte[] current = new byte[chunkSize];
        byte[] next = new byte[chunkSize];
        int currentLength = readFully(in, current);
        long total = 0;
        int index = 0;
        while (true) {
            // Look ahead one chunk to know whether this one is the last.
            int nextLength = currentLength == chunkSize ? readFully(in, next) : 0;
            boolean last = nextLength == 0;
            out.write(cipher(Cipher.ENCRYPT_MODE, spec, prefix, index, last)
                    .doFinal(current, 0, currentLength));
            total += currentLength;
            if (last) break;
            byte[] swap = current;
            current = next;
            next = swap;
            currentLength = nextLength;
            index++;
        }
        Arrays.fill(current, (byte) 0);
        Arrays.fill(next, (byte) 0);
        return total;
    }

    /** Decrypts [in] into [out]. Throws [AuthenticationException] on a wrong key. */
    public static void decrypt(InputStream in, OutputStream out, byte[] key)
            throws IOException, GeneralSecurityException {
        byte[] header = new byte[HEADER_LENGTH];
        if (readFully(in, header) < HEADER_LENGTH) throw new FormatException("Datei ist zu kurz");
        for (int i = 0; i < MAGIC.length; i++) {
            if (header[i] != MAGIC[i]) throw new FormatException("Unbekanntes Dateiformat");
        }
        int chunkSize = ((header[4] & 0xff) << 24) | ((header[5] & 0xff) << 16)
                | ((header[6] & 0xff) << 8) | (header[7] & 0xff);
        if (chunkSize < MIN_CHUNK_SIZE || chunkSize > MAX_CHUNK_SIZE) {
            throw new FormatException("Ungültige Blockgröße");
        }
        byte[] prefix = Arrays.copyOfRange(header, 8, 8 + PREFIX_LENGTH);
        SecretKeySpec spec = new SecretKeySpec(key, "AES");

        int sealedSize = chunkSize + TAG_LENGTH;
        byte[] current = new byte[sealedSize];
        byte[] next = new byte[sealedSize];
        int currentLength = readFully(in, current);
        int index = 0;
        while (true) {
            if (currentLength < TAG_LENGTH) throw new EOFException("Datei ist beschädigt");
            int nextLength = currentLength == sealedSize ? readFully(in, next) : 0;
            boolean last = nextLength == 0;
            byte[] clear;
            try {
                clear = cipher(Cipher.DECRYPT_MODE, spec, prefix, index, last)
                        .doFinal(current, 0, currentLength);
            } catch (AEADBadTagException e) {
                throw new AuthenticationException();
            }
            out.write(clear);
            Arrays.fill(clear, (byte) 0);
            if (last) break;
            byte[] swap = current;
            current = next;
            next = swap;
            currentLength = nextLength;
            index++;
        }
    }

    public static byte[] decryptToBytes(InputStream in, long sizeHint, byte[] key)
            throws IOException, GeneralSecurityException {
        int capacity = (int) Math.max(32, Math.min(sizeHint, Integer.MAX_VALUE - 64));
        ByteArrayOutputStream out = new ByteArrayOutputStream(capacity);
        decrypt(in, out, key);
        return out.toByteArray();
    }
}
