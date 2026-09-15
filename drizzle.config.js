import 'dotenv/config';

/** @type {import('drizzle-kit').Config} */
export default {
  schema: './server/db/schema.js',
  out: './server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/drawing-tool.db',
  },
};
