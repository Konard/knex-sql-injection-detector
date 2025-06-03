const db = require('knex')();

let userId = 42;

// Unsafe
db.raw(`SELECT * FROM users WHERE id = ${userId}`);

// Unsafe
db.raw(queryString);

// Safe
db.raw('SELECT * FROM users WHERE id = ?', [userId]);

// Safe
db.raw(`select * from func(?, ?, ?, ?)`, [1, 2, 3, 4])
