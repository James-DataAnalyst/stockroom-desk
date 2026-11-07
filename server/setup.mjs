import { databaseInfo, loadConfig, openPool, setupDatabase, setupError } from "./db.mjs";

loadConfig();
const pool = openPool();
try {
  await setupDatabase(pool);
  const info = await databaseInfo(pool);
  console.log("PostgreSQL " + info.version + " · " + info.database);
  console.log(info.orders + " orders · " + info.products + " products · " + info.locations + " locations · " + info.movements + " stock movements");
} catch (error) {
  console.error(setupError(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
