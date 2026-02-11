#!/usr/bin/env node
'use strict';

const readline = require('readline');
const chalk = require('chalk');
const { migrate, listProjects } = require('../src/index');
const ui = require('../src/ui');
const { normalizePath } = require('../src/utils');
const pkg = require('../package.json');

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) { printHelp(); process.exit(0); }
  if (args.version) { console.log(pkg.version); process.exit(0); }
  if (args.check) { await handleCheck(); process.exit(0); }
  if (args.list) { await handleList(); process.exit(0); }

  if (args.from && args.to) {
    await handleDirect(args.from, args.to, args.dryRun);
    process.exit(0);
  }

  if (args.from || args.to) {
    ui.error('--from ve --to birlikte kullanılmalıdır.');
    process.exit(1);
  }

  await handleInteractive();
}

function parseArgs(argv) {
  const args = { help: false, version: false, list: false, check: false, dryRun: false, from: null, to: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--version' || arg === '-v') args.version = true;
    else if (arg === '--list' || arg === '-l') args.list = true;
    else if (arg === '--check' || arg === '-c') args.check = true;
    else if (arg === '--dry-run' || arg === '-n') args.dryRun = true;
    else if (arg === '--from') args.from = argv[++i];
    else if (arg === '--to') args.to = argv[++i];
  }
  return args;
}

function printHelp() {
  console.log(`
${chalk.bold('claude-recontext')} v${pkg.version} — Claude Code proje yolunu taşıma aracı

${chalk.bold('Kullanım:')}
  claude-recontext                                          ${chalk.dim('İnteraktif mod')}
  claude-recontext --from <eski-yol> --to <yeni-yol>        ${chalk.dim('Doğrudan migrasyon')}
  claude-recontext --from <eski-yol> --to <yeni-yol> --dry-run  ${chalk.dim('Önizleme')}
  claude-recontext --check                                  ${chalk.dim('Kırık projeleri tespit et')}
  claude-recontext --list                                   ${chalk.dim('Proje listesi')}

${chalk.bold('Seçenekler:')}
  --from <yol>     Eski proje dizin yolu
  --to <yol>       Yeni proje dizin yolu
  --dry-run, -n    Değişiklikleri önizle, uygulama
  --check, -c      Dizini artık mevcut olmayan projeleri bul
  --list, -l       Kayıtlı projeleri listele
  --version, -v    Sürüm numarasını göster
  --help, -h       Bu yardım mesajını göster
`);
}

async function handleCheck() {
  ui.heading('Proje Sağlık Kontrolü');

  const projects = await listProjects();
  const broken = projects.filter(p => p.exists === false);
  const healthy = projects.filter(p => p.exists === true);
  const unknown = projects.filter(p => p.exists === null);

  if (broken.length === 0) {
    ui.success(`Tüm projeler sağlıklı. (${healthy.length} sağlam, ${unknown.length} bilinmiyor)`);
    return;
  }

  console.log(chalk.red.bold(`${broken.length} kırık proje bulundu:\n`));

  for (let i = 0; i < broken.length; i++) {
    const p = broken[i];
    const idx = String(i + 1).padStart(2);
    console.log(`  ${chalk.red(idx)}. ${chalk.red(p.projectPath)}`);
    console.log(`     ${chalk.dim(p.encoded)}`);
  }

  console.log();
  ui.info(`${healthy.length} sağlam, ${unknown.length} bilinmiyor.`);
  console.log();
  ui.info('Düzeltmek için:');
  console.log(chalk.dim('  claude-recontext --from "<eski-yol>" --to "<yeni-yol>"'));
  console.log(chalk.dim('  claude-recontext  (interaktif mod)'));
}

async function handleList() {
  ui.heading('Kayıtlı Claude Code Projeleri');

  const projects = await listProjects();

  if (projects.length === 0) {
    ui.info('Hiç proje bulunamadı.');
    return;
  }

  const maxIdxWidth = String(projects.length).length;

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const idx = String(i + 1).padStart(maxIdxWidth);
    let pathStr;
    if (p.exists === false) {
      pathStr = chalk.red(p.projectPath + ' (kırık)');
    } else if (p.hasRealPath) {
      pathStr = chalk.white(p.projectPath);
    } else {
      pathStr = chalk.dim(p.projectPath + ' (tahmini)');
    }
    console.log(`  ${chalk.cyan(idx)}. ${pathStr}`);
    console.log(`     ${chalk.dim(p.encoded)}`);
  }

  const broken = projects.filter(p => p.exists === false).length;
  console.log();
  ui.info(`Toplam ${projects.length} proje.` + (broken > 0 ? chalk.red(` ${broken} kırık.`) : ''));
}

async function handleDirect(fromPath, toPath, dryRun) {
  try {
    await migrate({ fromPath, toPath, dryRun });
  } catch (err) {
    ui.error(err.message);
    process.exit(1);
  }
}

async function handleInteractive() {
  ui.heading('Claude Code Proje Yolu Taşıma');

  const projects = await listProjects();

  if (projects.length === 0) {
    ui.error('Hiç proje bulunamadı.');
    process.exit(1);
  }

  // Show broken projects first, then others
  const broken = projects.filter(p => p.exists === false);
  const rest = projects.filter(p => p.exists !== false);
  const sorted = [...broken, ...rest];

  if (broken.length > 0) {
    console.log(chalk.red.bold(`${broken.length} kırık proje bulundu — önce bunlar listeleniyor.\n`));
  }

  console.log(chalk.bold('Taşımak istediğiniz projeyi seçin:\n'));

  const maxIdxWidth = String(sorted.length).length;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const idx = String(i + 1).padStart(maxIdxWidth);
    let pathStr;
    if (p.exists === false) {
      pathStr = chalk.red(p.projectPath + ' (kırık)');
    } else if (p.hasRealPath) {
      pathStr = chalk.white(p.projectPath);
    } else {
      pathStr = chalk.dim(p.projectPath);
    }
    console.log(`  ${chalk.cyan(idx)}. ${pathStr}`);
  }

  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  try {
    const numStr = await question(chalk.bold('Proje numarası: '));
    const num = parseInt(numStr, 10);

    if (isNaN(num) || num < 1 || num > sorted.length) {
      ui.error('Geçersiz seçim.');
      process.exit(1);
    }

    const selected = sorted[num - 1];
    console.log();
    ui.info(`Seçilen: ${selected.projectPath}`);
    console.log();

    const newPath = await question(chalk.bold('Yeni proje yolu: '));
    if (!newPath.trim()) {
      ui.error('Yol boş olamaz.');
      process.exit(1);
    }

    const resolvedNew = normalizePath(newPath.trim());
    const fromPath = selected.projectPath;

    console.log();
    ui.info(`Eski yol: ${fromPath}`);
    ui.info(`Yeni yol: ${resolvedNew}`);
    console.log();

    const confirm = await question(chalk.bold('Devam edilsin mi? (e/h): '));
    if (confirm.toLowerCase() !== 'e' && confirm.toLowerCase() !== 'evet') {
      ui.info('İptal edildi.');
      process.exit(0);
    }

    await migrate({ fromPath, toPath: resolvedNew });
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  ui.error(err.message);
  process.exit(1);
});
