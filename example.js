const db = require('knex')();

let userId = 42;

// Unsafe
db.raw(`SELECT * FROM users WHERE id = ${userId}`);

// Unsafe
db.raw('SELECT * ' + tableName + ' WHERE id = ?', [userId]);

// Unsafe
db.raw('SELECT * ' + tableName + ' WHERE id = 1');

// Unsafe
db.raw(queryString);

// Safe
db.raw('SELECT * FROM users WHERE id = ?', [userId]);

// Safe
db.raw('SELECT * FROM users WHERE id = 1');

// Safe
db.raw(`SELECT * FROM func(?, ?, ?, ?)`, [1, 2, 3, 4]);

// Safe
db.raw(`SELECT 1`);

// Safe
db.raw(
  'SELECT * '
+ 'FROM users'
+ 'WHERE id = ?', [userId]);

// Safe
db.raw(
  'SELECT * '
+ 'FROM users'
+ 'WHERE id = 1');