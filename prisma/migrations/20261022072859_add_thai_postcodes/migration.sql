-- CreateTable
CREATE TABLE "provinces" (
    "province_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT
);

-- CreateTable
CREATE TABLE "districts" (
    "district_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "province_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces" ("province_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subdistricts" (
    "subdistrict_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "district_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "postcode" TEXT,
    CONSTRAINT "subdistricts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts" ("district_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "districts_province_id_name_th_idx" ON "districts"("province_id", "name_th");

-- CreateIndex
CREATE INDEX "subdistricts_district_id_name_th_idx" ON "subdistricts"("district_id", "name_th");

-- CreateIndex
CREATE INDEX "subdistricts_postcode_idx" ON "subdistricts"("postcode");
