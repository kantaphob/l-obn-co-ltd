# Local database

This project uses Prisma ORM with PostgreSQL. Prisma schema and migration history live in `prisma/`. Existing local records were copied into PostgreSQL database `l_obn_loan`; the old SQLite file `.data/loans.sqlite` remains as a backup and is ignored by Git.

## Initialize a fresh local database

```sh
cp -n .env.example .env.local
npm install
createdb l_obn_loan
npm run db:migrate:deploy
npm run db:seed
npm run db:generate
```

Set `DATABASE_URL` in `.env.local` to the PostgreSQL connection string for the database you created.

Start Prisma Studio with `npm run db:studio`. Start the app with `npm run dev`.

## Administrator account

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env.local`, then run `npm run db:admin`. This creates or updates one `ADMIN` user, hashes the password before storing it, and grants full access using the `*` permission. The command only touches the account and role tables.

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
- Uploaded documents are stored outside PostgreSQL; the database stores file metadata and paths only.
- Use Prisma migrations for schema changes. `.data/` and `storage/` are private local data and must stay out of Git.
