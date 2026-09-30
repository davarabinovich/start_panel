import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function calculateCrc(buffer)
{
    let value = 0xffffffff;

    for (const byte of buffer)
    {
        value ^= byte;

        for (let bit = 0; bit < 8; bit += 1)
        {
            value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
        }
    }

    return (value ^ 0xffffffff) >>> 0;
}

function createChunk(name, data)
{
    const content = Buffer.concat([Buffer.from(name), data]);
    const length = Buffer.alloc(4);
    const checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE(calculateCrc(content));
    return Buffer.concat([length, content, checksum]);
}

function isInsideRectangle(x, y, left, top, size, radius)
{
    const offsetX = Math.max(left + radius - x, 0, x - left - size + radius);
    const offsetY = Math.max(top + radius - y, 0, y - top - size + radius);
    return x >= left && x <= left + size && y >= top && y <= top + size && offsetX ** 2 + offsetY ** 2 <= radius ** 2;
}

function createIcon(size)
{
    const pixels = Buffer.alloc(size * (size * 4 + 1));

    for (let y = 0; y < size; y += 1)
    {
        for (let x = 0; x < size; x += 1)
        {
            const channels = [0, 0, 0, 0];

            for (let sampleY = 0; sampleY < 4; sampleY += 1)
            {
                for (let sampleX = 0; sampleX < 4; sampleX += 1)
                {
                    const pointX = (x + (sampleX + .5) / 4) / size;
                    const pointY = (y + (sampleY + .5) / 4) / size;

                    if (!isInsideRectangle(pointX, pointY, .02, .02, .96, .24))
                    {
                        continue;
                    }

                    const isTile = [.23, .55].some(left => [.23, .55].some(top => isInsideRectangle(pointX, pointY, left, top, .22, .05)));
                    const color = isTile ? [255, 255, 255] : [82, 101, 217];
                    color.forEach((value, index) =>
                    {
                        channels[index] += value;
                    });
                    channels[3] += 255;
                }
            }

            const offset = y * (size * 4 + 1) + 1 + x * 4;
            const coverage = channels[3] / 255;

            for (let channel = 0; channel < 3; channel += 1)
            {
                pixels[offset + channel] = coverage ? Math.round(channels[channel] / coverage) : 0;
            }

            pixels[offset + 3] = Math.round(channels[3] / 16);
        }
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), createChunk("IHDR", header), createChunk("IDAT", deflateSync(pixels)), createChunk("IEND", Buffer.alloc(0))]);
}

const assetDirectory = new URL("../../assets/", import.meta.url);
mkdirSync(assetDirectory, { recursive: true });

for (const size of [16, 32, 48, 128])
{
    const path = new URL(`icon_${size}.png`, assetDirectory);
    writeFileSync(path, createIcon(size));
    console.log(fileURLToPath(path));
}
