declare module 'better-sqlite3' {
  class Database {
    constructor(filename: string);
    pragma(statement: string): void;
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): { lastInsertRowid: number; changes: number };
    };
  }

  export default Database;
}