# Local database

This project uses Prisma ORM with SQLite. Prisma schema and migration history live in `prisma/`; the local database file is `.data/loans.sqlite` and is ignored by Git.

## Initialize a fresh local database

```sh
cp -n .env.example .env.local
npm install
mkdir -p .data
touch .data/loans.sqlite
npm run db:migrate -- --name init
npm run db:seed
npm run db:generate
```

Start Prisma Studio with `npm run db:studio`. Start the app with `npm run dev`.

## Thai postcode reference data

The local database includes `Province`, `District`, and `Subdistrict` tables. Import the supplied PostgreSQL-compatible SQL data with Prisma:

```sh
npm run data:postcode -- "/path/to/thailand-province"
```

The folder must contain `province.sql.pg`, `district.sql.pg`, and `subdistrict.sql.pg`. Importing replaces only these three reference tables and keeps their source IDs and postcode values.

## Import company CSV files

The importer uses Prisma Client and can be rerun safely because it upserts records by employee code and source-row hash:

```sh
npm run data:import -- "/path/to/borrowers.csv" "/path/to/company-ledger.csv"
```

## Data conventions

- Money amounts use `BigInt` satang (100 satang = 1 baht).
- Status values are stored as stable English strings and translated in the UI.
- Uploaded documents are stored outside SQLite; the database stores file metadata and paths only.
- Use Prisma migrations for schema changes. `.data/` and `storage/` are private local data and must stay out of Git.
