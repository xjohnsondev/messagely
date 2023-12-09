/** User class for message.ly */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ExpressError = require("../expressError");
const { BCRYPT_WORK_FACTOR } = require("../config");
const db = require("../db");
const { authenticateJWT } = require("../middleware/auth");

function getTime(){
  let date = new Date();
  return date.toISOString();
}
/** User of the site. */

class User {
  /** register new user -- returns
   *    {username, password, first_name, last_name, phone}
   */

  static async register({
    username,
    password,
    first_name,
    last_name,
    phone,
    join_at,
    last_login_at,
  }) {
    if (!username || !password || !first_name || !last_name || !phone) {
      throw new ExpressError("Please complete all of the fields", 400);
    }
    const hashedPass = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    let time = getTime();

    const results = await db.query(
      `
      INSERT INTO users (username, password, first_name, last_name, phone, join_at, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING username, password, first_name, last_name, phone, join_at, last_login_at`,
      [username, hashedPass, first_name, last_name, phone, time, time]
    );
    return results.rows[0];
  }

  /** Authenticate: is this username/password valid? Returns boolean. */

  static async authenticate(username, password) {
    const result = await db.query(
      "SELECT password FROM users WHERE username = $1",
      [username]
    );
    let user = result.rows[0];
    return user && (await bcrypt.compare(password, user.password));
  }

  /** Update last_login_at for user */

  static async updateLoginTimestamp(username) {
    let time = getTime();
    const result = await db.query(
      `UPDATE users
         SET last_login_at = $1
         WHERE username = $2
         RETURNING username`,
      [time, username]);

    if (!result.rows[0]) {
    throw new ExpressError(`No such user: ${username}`, 404);
    }
  }

  /** All: basic info on all users:
   * [{username, first_name, last_name, phone}, ...] */

  static async all() {
    const results = await db.query(`
    SELECT username, first_name, last_name, phone
     FROM users
   `);
    return results.rows
  }

  /** Get: get user by username
   *
   * returns {username,
   *          first_name,
   *          last_name,
   *          phone,
   *          join_at,
   *          last_login_at } */

  static async get(username) {
    const result = await db.query(`
    SELECT username, first_name, last_name, phone, join_at, last_login_at
    FROM users
    WHERE username = $1`,
    [username])
    return result.rows[0];
  }

  /** Return messages from this user.
   *
   * [{id, to_user, body, sent_at, read_at}]
   *
   * where to_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesFrom(username) {
    const results = await db.query(`
      SELECT 
        m.id,
        m.to_username,
        m.body,
        m.sent_at,
        m.read_at,
        u.username,
        u.first_name,
        u.last_name,
        u.phone
      FROM messages AS m
      JOIN users AS u ON m.to_username = u.username
      WHERE m.from_username = $1
    `, [username]);
    return results.rows;
  }
  

  /** Return messages to this user.
   *
   * [{id, from_user, body, sent_at, read_at}]
   *
   * where from_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesTo(username) {
    const results = await db.query(`
      SELECT 
        m.id,
        m.to_username,
        m.body,
        m.sent_at,
        m.read_at,
        u.username,
        u.first_name,
        u.last_name,
        u.phone
      FROM messages AS m
      JOIN users AS u ON m.from_username = u.username
      WHERE m.from_username = $1
    `, [username]);
    return results.rows;
  }
}

module.exports = User;
