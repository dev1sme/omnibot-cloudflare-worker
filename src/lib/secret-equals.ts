const encoder = new TextEncoder();

// Hashes both values so that values of different lengths can be compared.
export async function secretEquals(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all(
    [a, b].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  return crypto.subtle.timingSafeEqual(hashA as ArrayBuffer, hashB as ArrayBuffer);
}

export async function verifySecretHeader(
  headers: Headers,
  headerName: string,
  secret: string | undefined,
): Promise<boolean> {
  const provided = headers.get(headerName);
  if (!provided || !secret) return false;
  return secretEquals(provided, secret);
}
