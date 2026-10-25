const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { getDatabase } = require('./db');

// Read GraphQL Schema
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');

// Resolvers over SQLite Database
const resolvers = {
  Query: {
    equipments: async (_, { onlyAvailable }) => {
      const db = await getDatabase();
      if (onlyAvailable !== undefined) {
        return await db.all('SELECT * FROM equipments WHERE is_available = ?', [onlyAvailable ? 1 : 0]);
      }
      return await db.all('SELECT * FROM equipments');
    },
    equipment: async (_, { id }) => {
      const db = await getDatabase();
      return await db.get('SELECT * FROM equipments WHERE id = ?', [id]);
    }
  },
  Mutation: {
    addEquipment: async (_, { input }) => {
      const db = await getDatabase();
      const { name, category, daily_rate, is_available } = input;
      
      const result = await db.run(
        'INSERT INTO equipments (name, category, daily_rate, is_available) VALUES (?, ?, ?, ?)',
        [name, category, daily_rate, is_available ? 1 : 0]
      );

      return {
        id: result.lastID,
        name,
        category,
        daily_rate,
        is_available: !!is_available
      };
    }
  }
};

async function main() {
  // 1. Start Apollo GraphQL Server on port 4000
  const server = new ApolloServer({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 }
  });
  console.log(`🚀 AgriRent GraphQL API running at ${url}`);

  // 2. Start Simple HTTP server for frontend (public/index.html) on port 3000
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const staticServer = http.createServer((req, res) => {
    fs.readFile(htmlPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading index.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      }
    });
  });

  staticServer.listen(3000, () => {
    console.log(`🌐 Frontend UI live at http://localhost:4000`);
  });
}

main().catch(err => console.error(err));