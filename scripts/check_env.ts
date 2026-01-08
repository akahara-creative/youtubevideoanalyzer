import "dotenv/config";

console.log("USE_OLLAMA:", process.env.USE_OLLAMA);
console.log("OLLAMA_MODEL:", process.env.OLLAMA_MODEL);
console.log("ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY ? "(Present)" : "(Missing)");
