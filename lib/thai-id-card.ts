import pcsclite from "@mbarrie2/pcsclite";

export type ThaiIdCardData = {
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

function decode(bytes: Buffer) {
  return new TextDecoder("windows-874").decode(bytes).replace(/[\0\xFF]/g, "").trim().replace(/\s+/g, " ");
}

function date(bytes: Buffer) {
  const value = decode(bytes).replace(/\D/g, "");
  if (value.length !== 8) return "";
  let year = Number(value.slice(0, 4));
  if (year > 2400) year -= 543;
  return `${year}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function commandFor(offset: number, length: number) {
  return Buffer.from([0x80, 0xb0, (offset >> 8) & 0xff, offset & 0xff, 0x02, 0x00, length]);
}

let readInProgress = false;

export async function readThaiIdCard(): Promise<ThaiIdCardData> {
  if (readInProgress) throw new Error("กำลังอ่านบัตรอยู่ กรุณารอสักครู่แล้วลองใหม่");
  readInProgress = true;
  let pcsc: ReturnType<typeof pcsclite>;
  try { pcsc = pcsclite(); }
  catch (error) {
    readInProgress = false;
    throw error instanceof Error ? error : new Error("เปิดการเชื่อมต่อ PC/SC ไม่สำเร็จ");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let activeReader: { connected: boolean; SCARD_LEAVE_CARD: number; disconnect: (disposition: number, callback: (error?: Error | null) => void) => void; close: () => void } | undefined;
    const finish = (error?: Error, data?: ThaiIdCardData) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const complete = () => {
        try { pcsc.close(); } catch { /* The card data is already read; allow a later request to retry. */ }
        readInProgress = false;
        if (error) reject(error);
        else resolve(data!);
      };
      const closeReader = (reader: NonNullable<typeof activeReader>) => {
        try { reader.close(); } catch { /* The context will still be closed below. */ }
      };
      const reader = activeReader;
      activeReader = undefined;
      if (!reader) return complete();
      if (!reader.connected) {
        closeReader(reader);
        complete();
        return;
      }
      try {
        reader.disconnect(reader.SCARD_LEAVE_CARD, () => {
          closeReader(reader);
          complete();
        });
      } catch {
        closeReader(reader);
        complete();
      }
    };
    const timer = setTimeout(() => finish(new Error("ไม่พบเครื่องอ่านหรือบัตรภายใน 20 วินาที กรุณาเสียบบัตรแล้วลองอีกครั้ง")), 20_000);
    pcsc.on("error", (error) => finish(new Error(error.message || "เชื่อมต่อ PC/SC ไม่สำเร็จ")));
    pcsc.on("reader", (reader) => {
      if (settled) { try { reader.close(); } catch { /* Reader already finished. */ } return; }
      if (!/ACS|ACR39/i.test(reader.name)) return;
      activeReader = reader;
      let reading = false;
      reader.on("error", (error) => finish(new Error(error.message || "อ่านบัตรไม่สำเร็จ")));
      reader.on("end", () => finish(new Error("เครื่องอ่านถูกถอดออก กรุณาเสียบเครื่องอ่านแล้วลองใหม่")));
      const readIfPresent = (state: number) => {
        if (reading || !(state & reader.SCARD_STATE_PRESENT)) return;
        reading = true;
        reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, async (connectError, protocol) => {
          if (connectError) {
            const detail = connectError instanceof Error ? connectError.message : String(connectError);
            return finish(new Error(`เชื่อมต่อบัตรไม่สำเร็จ: ${detail}`));
          }
          const transmit = (apdu: Buffer) => new Promise<Buffer>((ok, bad) => reader.transmit(apdu, 258, protocol, (error, response) => error ? bad(error) : ok(response)));
          try {
            const selected = await transmit(Buffer.from([0x00, 0xa4, 0x04, 0x00, 0x08, 0xa0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01]));
            const readResponse = async (initialResponse: Buffer) => {
              const payload: Buffer[] = [];
              let response = initialResponse;
              while (true) {
                if (response.length < 2) throw new Error("บัตรตอบกลับไม่ครบ");
                const sw1 = response.at(-2)!;
                const sw2 = response.at(-1)!;
                payload.push(response.subarray(0, -2));
                if (sw1 === 0x90 && sw2 === 0x00) return Buffer.concat(payload);
                if (sw1 !== 0x61) throw new Error(`บัตรไม่ยอมให้อ่านข้อมูล (รหัส ${sw1.toString(16)}${sw2.toString(16)})`);
                response = await transmit(Buffer.from([0x00, 0xc0, 0x00, 0x00, sw2]));
              }
            };
            await readResponse(selected);
            const readFile = async (offset: number, length: number) => {
              return readResponse(await transmit(commandFor(offset, length)));
            };
            const offsets = { nationalId: [0x0004, 13], name: [0x0011, 64], nameEn: [0x0075, 64], dob: [0x00d9, 8], gender: [0x00e1, 1], issuer: [0x00f6, 64], issued: [0x0167, 8], expires: [0x016f, 8], address: [0x1579, 64] } as const;
            const values: Record<string, Buffer> = {};
            for (const [key, [offset, length]] of Object.entries(offsets)) {
              values[key] = await readFile(offset, length);
            }
            const photoParts: Buffer[] = [];
            for (let part = 1; part <= 20; part += 1) {
              const offset = (part << 8) | (0x7b - part + 1);
              photoParts.push(await readFile(offset, 0xff));
            }
            const photo = Buffer.concat(photoParts);
            if (photo.length < 4 || photo[0] !== 0xff || photo[1] !== 0xd8) throw new Error("อ่านรูปถ่ายจากชิปไม่สำเร็จ กรุณาถอดบัตรแล้วลองใหม่");
            const thai = decode(values.name).split("#").filter(Boolean);
            const english = decode(values.nameEn).split("#").filter(Boolean);
            const data: ThaiIdCardData = {
              nationalId: decode(values.nationalId).replace(/\D/g, ""),
              fullName: thai.join(" ").trim(),
              nameEn: english.join(" ").trim(),
              dateOfBirth: date(values.dob),
              gender: decode(values.gender) === "1" ? "ชาย" : decode(values.gender) === "2" ? "หญิง" : "",
              address: decode(values.address),
              cardIssuer: decode(values.issuer),
              cardIssuedOn: date(values.issued),
              cardExpiresOn: date(values.expires),
              photo: photo.toString("base64"),
            };
            if (!/^\d{13}$/.test(data.nationalId) || !data.fullName) throw new Error("อ่านข้อมูลบัตรไม่ครบ กรุณาถอดบัตรแล้วเสียบใหม่");
            finish(undefined, data);
          } catch (error) { finish(error instanceof Error ? error : new Error("อ่านข้อมูลจากบัตรไม่สำเร็จ")); }
        });
      };
      reader.on("status", (status) => readIfPresent(status.state));

      // The card may already be in the reader before the user starts the read request.
      // Query current state as well as listening for the next insertion event.
      reader.get_status((error, state) => {
        if (!error) readIfPresent(state);
      });
    });
  });
}
