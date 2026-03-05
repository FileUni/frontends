export const createClientUniqueId = (): string => {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `id_${Date.now()}_${randomPart}`;
};

