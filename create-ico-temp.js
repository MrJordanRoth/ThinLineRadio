const sharp = require('./client/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const sourceIcon = path.join(__dirname, 'ThinlineRadio-Mobile', 'assets', 'icons', 'icon.png');
const outputIco = path.join(__dirname, 'server', 'icon.ico');

// For Windows .ico, we need multiple sizes embedded
// Most tools expect separate PNG files to combine
const sizes = [16, 32, 48, 64, 128, 256];
const tempFiles = [];

async function createIco() {
    try {
        // Create temp PNGs at different sizes
        console.log('Creating icon sizes...');
        for (const size of sizes) {
            const tempFile = path.join(__dirname, 'server', `icon-${size}.png`);
            await sharp(sourceIcon)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(tempFile);
            tempFiles.push(tempFile);
            console.log(`  ✓ Created ${size}x${size}`);
        }

        // Try to use png-to-ico if available
        try {
            const pngToIco = require('./client/node_modules/png-to-ico');
            console.log('Converting to .ico format...');
            const buf = await pngToIco(tempFiles);
            fs.writeFileSync(outputIco, buf);
            console.log(`✓ Created: ${outputIco}`);
        } catch (err) {
            console.log('png-to-ico not available, using largest size as .ico');
            // Fallback: just copy the largest PNG as ico
            // Windows will still recognize it
            fs.copyFileSync(tempFiles[tempFiles.length - 1], outputIco);
            console.log(`✓ Created: ${outputIco} (single size fallback)`);
        }

        // Clean up temp files
        for (const file of tempFiles) {
            fs.unlinkSync(file);
        }

        console.log('\n✓ Server icon created successfully!');
    } catch (error) {
        console.error('Error creating icon:', error);
        process.exit(1);
    }
}

createIco();
