import { prisma } from "./prisma";

export type ProvinceOption = { id: string; name: string; nameEn: string };
export type DistrictOption = { id: string; provinceId: string; name: string; nameEn: string };
export type SubdistrictOption = { id: string; districtId: string; name: string; nameEn: string; postcode: string };

export async function resolveAddressCodes(subdistrictCode: string, districtCode: string, provinceCode: string) {
  const subdistrictId = Number(subdistrictCode);
  const districtId = Number(districtCode);
  const provinceId = Number(provinceCode);
  if (![subdistrictId, districtId, provinceId].every(Number.isSafeInteger)) return null;

  const subdistrict = await prisma.subdistrict.findUnique({
    where: { id: subdistrictId },
    include: { district: { include: { province: true } } },
  });
  if (!subdistrict || subdistrict.districtId !== districtId || subdistrict.district.provinceId !== provinceId) return null;
  return {
    province: { id: String(subdistrict.district.province.id), name: subdistrict.district.province.nameTh, nameEn: subdistrict.district.province.nameEn ?? "" },
    district: { id: String(subdistrict.district.id), provinceId: String(subdistrict.district.provinceId), name: subdistrict.district.nameTh, nameEn: subdistrict.district.nameEn ?? "" },
    subdistrict: { id: String(subdistrict.id), districtId: String(subdistrict.districtId), name: subdistrict.nameTh, nameEn: subdistrict.nameEn ?? "", postcode: subdistrict.postcode ?? "" },
  };
}
