import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// También revisamos public/js: un error en un módulo impediría cargar toda la página.
async function comprobarCarpeta(carpeta) {
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    const ruta = `${carpeta}/${entrada.name}`;
    if (entrada.isDirectory()) {
      await comprobarCarpeta(ruta);
    } else if (/\.(mjs|js)$/.test(entrada.name)) {
      const resultado = spawnSync(process.execPath, ['--check', ruta], { stdio: 'inherit' });
      if (resultado.error) throw resultado.error;
      if (resultado.status !== 0) process.exit(resultado.status ?? 1);
    }
  }
}
for (const carpeta of ['src', 'scripts', 'public', 'test']) await comprobarCarpeta(carpeta);
console.log('Sintaxis JavaScript comprobada.');

const paginas = spawnSync(process.execPath, ['scripts/build-pages.mjs', '--check'], {
  stdio: 'inherit',
});
if (paginas.error) throw paginas.error;
if (paginas.status !== 0) process.exit(paginas.status ?? 1);
