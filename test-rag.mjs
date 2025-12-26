import { ChromaClient } from "chromadb";

async function testRAG() {
  try {
    console.log("Connecting to ChromaDB...");
    const client = new ChromaClient({
      path: "http://localhost:8000",
    });

    console.log("Getting or creating collection...");
    let collection;
    try {
      collection = await client.getCollection({ name: "test_collection" });
      console.log("✓ Connected to existing collection");
    } catch (error) {
      console.log("Creating new collection...");
      collection = await client.createCollection({
        name: "test_collection",
        metadata: { description: "Test collection" },
      });
      console.log("✓ Created new collection");
    }

    console.log("Adding test document...");
    await collection.add({
      ids: ["test1"],
      embeddings: [[0.1, 0.2, 0.3]],
      documents: ["This is a test document"],
      metadatas: [{ type: "test" }],
    });
    console.log("✓ Added test document");

    console.log("Querying...");
    const results = await collection.query({
      queryEmbeddings: [[0.1, 0.2, 0.3]],
      nResults: 1,
    });
    console.log("✓ Query successful:", results);

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Error:", error);
    console.error("Stack:", error.stack);
  }
}

testRAG();
