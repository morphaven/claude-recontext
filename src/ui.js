'use strict';

const chalk = require('chalk');

const SYMBOLS = {
  success: chalk.green('✔'),
  error: chalk.red('✖'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  arrow: chalk.cyan('→'),
};

function success(msg) {
  console.log(`${SYMBOLS.success} ${msg}`);
}

function error(msg) {
  console.error(`${SYMBOLS.error} ${chalk.red(msg)}`);
}

function warning(msg) {
  console.log(`${SYMBOLS.warning} ${chalk.yellow(msg)}`);
}

function info(msg) {
  console.log(`${SYMBOLS.info} ${msg}`);
}

function heading(msg) {
  console.log(`\n${chalk.bold.underline(msg)}\n`);
}

function migration(from, to) {
  console.log(`  ${chalk.dim(from)}`);
  console.log(`  ${SYMBOLS.arrow} ${chalk.green(to)}`);
}

function fileUpdated(filePath) {
  console.log(`  ${SYMBOLS.success} ${chalk.dim(filePath)}`);
}

function dryRunBanner() {
  console.log(chalk.bgYellow.black(' DRY RUN ') + ' Hiçbir değişiklik yapılmayacak.\n');
}

module.exports = {
  SYMBOLS,
  success,
  error,
  warning,
  info,
  heading,
  migration,
  fileUpdated,
  dryRunBanner,
};
