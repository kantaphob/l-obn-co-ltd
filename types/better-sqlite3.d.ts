declare module "better-sqlite3" {
  type RunResult = { changes: number };
  type Statement = {
    get(...parameters: unknown[]): Record<string, unknown> | undefined;
    all(...parameters: unknown[]): Record<string, unknown>[];
    run(...parameters: unknown[]): RunResult;
  };

  class Database {
    constructor(filename: string);
    pragma(source: string): unknown;
    prepare(source: string): Statement;
  }

  export default Database;
}
