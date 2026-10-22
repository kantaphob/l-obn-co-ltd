export type CardData = {
  nationalId: string;
  fullName: string;
  nameEn: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  cardIssuer: string;
  cardIssuedOn: string;
  cardExpiresOn: string;
  photo: string;
};

export const emptyCardData: CardData = {
  nationalId: "",
  fullName: "",
  nameEn: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  cardIssuer: "",
  cardIssuedOn: "",
  cardExpiresOn: "",
  photo: "",
};

type ReadCardResponse = { card?: CardData; message?: string };

export async function readCardFromDevice(): Promise<CardData> {
  const response = await fetch("/api/card-reader", { method: "POST" });
  const result = await response.json().catch(() => null) as ReadCardResponse | null;

  if (!response.ok || !result?.card) {
    throw new Error(result?.message ?? "อ่านบัตรไม่สำเร็จ");
  }

  return result.card;
}
