import { constants, copyFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const directories = ['', 'apps/api/', 'apps/admin/', 'apps/mobile/'];

for (const directory of directories) {
  const target = new URL(`${directory}.env`, root);
  try {
    copyFileSync(
      new URL(`${directory}.env.example`, root),
      target,
      constants.COPYFILE_EXCL,
    );
    console.log(`Oluşturuldu: ${directory}.env`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Mevcut ayarlar korundu: ${directory}.env`);
  }
}

console.log(
  'Fiziksel telefon için apps/mobile/.env içindeki API adresini bilgisayarınızın yerel ağ IP adresiyle güncelleyin.',
);
