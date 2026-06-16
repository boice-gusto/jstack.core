import chalk from "chalk";

export function createLogger(debug: boolean) {
  return {
    debug: (...a: unknown[]) => debug && console.log(chalk.gray("[debug]"), ...a),
    info: (...a: unknown[]) => console.log(chalk.blue("[jstack]"), ...a),
    ok: (...a: unknown[]) => console.log(chalk.green("✔"), ...a),
    warn: (...a: unknown[]) => console.warn(chalk.yellow("!"), ...a),
    err: (...a: unknown[]) => console.error(chalk.red("✖"), ...a),
  };
}
