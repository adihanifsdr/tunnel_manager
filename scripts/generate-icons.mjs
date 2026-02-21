import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'resources', 'icon.svg');
const buildDir = join(root, 'build');
const resourcesDir = join(root, 'resources');

// Ensure directories exist
if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });
if (!existsSync(resourcesDir)) mkdirSync(resourcesDir, { recursive: true });

const svgBuffer = readFileSync(svgPath);

// PNG sizes needed for various platforms
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function generatePNGs() {
  console.log('Generating PNG icons...');
  const generated = [];

  for (const size of pngSizes) {
    const outputPath = join(buildDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    generated.push(outputPath);
    console.log(`  Created: icon-${size}x${size}.png`);
  }

  // Main icon.png at 512x512 for build directory
  const mainBuildIcon = join(buildDir, 'icon.png');
  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(mainBuildIcon);
  console.log('  Created: build/icon.png (512x512)');

  // Main icon.png at 512x512 for resources directory
  const mainResourceIcon = join(resourcesDir, 'icon.png');
  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(mainResourceIcon);
  console.log('  Created: resources/icon.png (512x512)');

  return generated;
}

async function generateICO() {
  console.log('Generating ICO icon...');
  // Windows ICO needs 16, 24, 32, 48, 64, 128, 256 sizes
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of icoSizes) {
    const buf = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
  }

  const icoBuffer = await pngToIco(pngBuffers);
  const icoPath = join(buildDir, 'icon.ico');
  writeFileSync(icoPath, icoBuffer);
  console.log('  Created: build/icon.ico');
}

async function generateICNS() {
  // ICNS generation requires macOS tools or a dedicated library.
  // We'll create the required PNG sizes that can be assembled into ICNS on macOS.
  // For now, create a 1024x1024 PNG that electron-builder can use.
  console.log('Generating ICNS-compatible PNGs...');

  const icnsSizes = [
    { name: 'icon_16x16', size: 16 },
    { name: 'icon_16x16@2x', size: 32 },
    { name: 'icon_32x32', size: 32 },
    { name: 'icon_32x32@2x', size: 64 },
    { name: 'icon_128x128', size: 128 },
    { name: 'icon_128x128@2x', size: 256 },
    { name: 'icon_256x256', size: 256 },
    { name: 'icon_256x256@2x', size: 512 },
    { name: 'icon_512x512', size: 512 },
    { name: 'icon_512x512@2x', size: 1024 },
  ];

  const icnsDir = join(buildDir, 'icon.iconset');
  if (!existsSync(icnsDir)) mkdirSync(icnsDir, { recursive: true });

  for (const { name, size } of icnsSizes) {
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(icnsDir, `${name}.png`));
    console.log(`  Created: icon.iconset/${name}.png`);
  }

  console.log('  Note: To generate .icns, run on macOS: iconutil -c icns build/icon.iconset');
  console.log('  electron-builder will auto-generate .icns from icon.png on macOS builds.');
}

async function main() {
  console.log('=== Tunnel Manager Icon Generator ===\n');
  console.log(`Source SVG: ${svgPath}\n`);

  await generatePNGs();
  console.log('');
  await generateICO();
  console.log('');
  await generateICNS();

  console.log('\n=== Icon generation complete! ===');
  console.log('\nGenerated files:');
  console.log('  build/icon.png       - Main PNG (512x512)');
  console.log('  build/icon.ico       - Windows icon');
  console.log('  build/icon-NxN.png   - Various PNG sizes');
  console.log('  build/icon.iconset/  - macOS iconset PNGs');
  console.log('  resources/icon.png   - App resource icon');
  console.log('  resources/icon.svg   - Source SVG');
}

main().catch(console.error);
