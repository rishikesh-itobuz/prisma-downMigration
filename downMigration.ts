/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const { execSync } = require("child_process");
const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

// Invocation command :- npm run branch:db
const branchDataBase = () => {
  try {
    if (!fs.existsSync("./prisma/downMigration")) {
      // count total number of applied migration and save it in initialMigrationCount.txt
      const migrationFolderCount = fs.readdirSync("./prisma/migrations");
      fs.mkdirSync("./prisma/downMigration");
      fs.writeFileSync("./prisma/downMigration/initialMigrationCount.txt", (migrationFolderCount.length - 1).toString());

      // Have a backup of initial schema.prisma file in baselineSchema.prisma
      const currentSchemaData = fs.readFileSync("./prisma/schema.prisma", "utf-8");
      fs.writeFileSync("./prisma/downMigration/baselineSchema.prisma", currentSchemaData);
    } else {
      console.log("----- You have already branched the database -----");
    }
  } catch (err) {
    console.log(err);
  }
};

// Used AFTER every migrate dev --create-only or BEFORE migrate dev
// Invocation command :- npm run down:migration
const downMigration = () => {
  try {
    if (!fs.existsSync("./prisma/downMigration/sql")) {
      fs.mkdirSync("./prisma/downMigration/sql");
    }
    // create a down migration(i.e opposite of changes done in schema)
    const command =
      "npx prisma migrate diff \
      --from-schema-datamodel prisma/schema.prisma \
      --to-schema-datasource prisma/schema.prisma \
      --script > ./prisma/downMigration/sql/currentDownMigration.sql";
    execSync(command);

    // combine all down migration(i.e currentDownMigration) in allDownMigration.sql
    const downMigrationSql = fs.readFileSync("./prisma/downMigration/sql/currentDownMigration.sql", "utf-8");
    const initialMigrationCount = Number(fs.readFileSync("./prisma/downMigration/initialMigrationCount.txt"));
    const currentMigrationCount = fs.readdirSync("./prisma/migrations").length - 1;

    if (initialMigrationCount === currentMigrationCount) {
      fs.writeFileSync("./prisma/downMigration/sql/allDownMigration.sql", downMigrationSql);
      return;
    }
    fs.appendFileSync("./prisma/downMigration/sql/allDownMigration.sql", downMigrationSql);
  } catch (err) {
    console.log(err);
  }
};
// Invocation command :- npm run revert:migrations
const revertMigration = async () => {
  const currentSchemaData = fs.readFileSync("./prisma/schema.prisma", "utf-8");
  const baselineSchemaData = fs.readFileSync("./prisma/downMigration/baselineSchema.prisma", "utf-8");

  fs.writeFileSync("./prisma/schema.prisma", baselineSchemaData);

  execSync("npx prisma migrate dev --name rollback --create-only");

  const allDownMigrationSql = fs.readFileSync("./prisma/downMigration/sql/allDownMigration.sql", "utf-8");

  const appliedMigration = fs.readdirSync("./prisma/migrations");

  fs.writeFileSync(`./prisma/migrations/${appliedMigration[appliedMigration.length - 2]}/migration.sql`, allDownMigrationSql);

  execSync("npx prisma migrate dev");

  const initialMigrationCount = Number(fs.readFileSync("./prisma/downMigration/initialMigrationCount.txt", "utf-8"));

  const newAppliedMigration = appliedMigration.slice(initialMigrationCount, appliedMigration.length - 1);

  const newAppliedMigrationName = newAppliedMigration.map((e) => `'${e}'`).join(",");

  await prisma.$executeRaw(Prisma.raw(`DELETE from _prisma_migrations where migration_name IN (${newAppliedMigrationName})`));

  fs.rmSync(`./prisma/migrations/${appliedMigration[appliedMigration.length - 2]}`, { recursive: true });

  fs.writeFileSync("./prisma/schema.prisma", currentSchemaData);
};


// Invocation command :- npm run rollback:migrations
const rollbackMigration = async () => {
  await revertMigration();

  fs.rmSync("./prisma/downMigration", { recursive: true });
};

module.exports = { downMigration, branchDataBase, rollbackMigration, revertMigration };



/*"branch:db": "npx run-func src/downMigration.ts branchDataBase",
    "down:migration": "npx run-func src/downMigration.ts downMigration",
    "revert:migrations": "npx run-func src/downMigration.ts revertMigration",
    "rollback:migrations": "npx run-func src/downMigration.ts rollbackMigration" */


// pacakageNeeded : run-func, child-process
