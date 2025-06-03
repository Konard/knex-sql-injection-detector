const db = require('knex')();

let userId = 42;

// Unsafe
db.raw(`SELECT * FROM users WHERE id = ${userId}`);

// Safe
db.raw('SELECT * FROM users WHERE id = ?', [userId]);

// Unknown
db.raw(queryString);
