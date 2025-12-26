import { drizzle } from "drizzle-orm/mysql2";
import { mysqlTable, int, text } from "drizzle-orm/mysql-core";

const db = drizzle(process.env.DATABASE_URL);

const testTable = mysqlTable("test_insert_result", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name"),
});

async function testInsert() {
  try {
    const result = await db.insert(testTable).values({ name: "test" });
    console.log("Full result:", result);
    console.log("result.insertId:", result.insertId);
    console.log("result[0]:", result[0]);
    console.log("typeof result:", typeof result);
    console.log("Array.isArray(result):", Array.isArray(result));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testInsert();
