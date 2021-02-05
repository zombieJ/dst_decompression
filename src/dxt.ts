import * as jimp from "jimp";
import { BufferData, debug } from "./util";

function parse565(color: number) {
  let value = color;
  const b = (value & ((1 << 5) - 1)) << 3;

  value <<= 5;
  const g = (value & ((1 << 6) - 1)) << 2;

  value <<= 6;
  const r = (value & ((1 << 5) - 1)) << 3;

  return { r, g, b };
}

function rgba2hex(r: number, g: number, b: number, a: number) {
  let color = r;
  color = (color << 8) | g;
  color = (color << 8) | b;
  color = (color << 8) | a;
  return color;
}

const colorSet = new Set<number>();
function parseBlock(data: BufferData) {
  // ====================== Alpha ======================
  const alpha0 = data.readByte();
  const alpha1 = data.readByte();

  // Build alpha table
  const alphas: number[] = [alpha0, alpha1];

  if (alpha0 <= alpha1) {
    for (let i = 1; i < 5; ++i) {
      alphas[1 + i] = ((5 - i) * alpha0 + i * alpha1) / 5;
    }
    alphas[6] = 0;
    alphas[7] = 255;
  } else {
    for (let i = 1; i < 7; ++i) {
      alphas[1 + i] = ((7 - i) * alpha0 + i * alpha1) / 7;
    }
  }

  debug(0, "Alphas:", alphas);

  // >>> Get cell alpha
  const alphaList: number[] = [];
  for (let i = 0; i < 2; i += 1) {
    let value = 0;

    // grab 3 bytes
    for (let j = 0; j < 3; j += 1) {
      value |= data.readByte() << (8 * j);
    }

    // unpack 8 3-bit values from it
    for (let j = 0; j < 8; j += 1) {
      const alphaIndex = (value >> (3 * j)) & ((1 << 3) - 1);
      alphaList.push(alphas[alphaIndex]);
    }
  }

  debug(0, "Cell Aplha:", alphaList);

  // ====================== Color ======================
  const color0 = data.readUint16();
  const color1 = data.readUint16();

  // Build color table
  const colors: number[] = [color0, color1];

  if (color0 <= color1) {
    colors[2] = (color0 + color1) / 2;
    colors[3] = 0;
  } else {
    for (let i = 1; i < 3; i += 1) {
      colors[1 + i] = ((3 - i) * color0 + i * color1) / 3;
    }
  }

  debug(0, "Colors:", colors);

  // >>> Get cell color
  const colorList: number[] = [];
  for (let y = 0; y < 4; y += 1) {
    let value = data.readByte();

    for (let x = 0; x < 4; x += 1) {
      const colorIndex = value & ((1 << 2) - 1);
      const color565 = colors[colorIndex];
      colorList.push(color565);
    }
  }

  debug(0, "Cell Color:", colorList);

  return colorList.map((color, index) => {
    const rgb = parse565(color);
    const rgba = rgba2hex(rgb.r, rgb.g, rgb.b, alphaList[index])
    colorSet.add(rgba);
    return rgba;
  });
}

export function parseDXT5(buffer: Buffer, width: number, height: number) {
  const data = new BufferData(buffer);
  debug(0, "Buffer Size:", buffer.length, `${buffer.length / 8}`);

  const img = new jimp(width, height);
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < height; x += 4) {
      // Fill 4 * 4
      const blockColors = parseBlock(data);
      blockColors.forEach((hexColor, index) => {
        const px = x + index % 4;
        const py = y + Math.floor(index / 4);
        img.setPixelColor(hexColor, px, py);
      });
    }
  }

  debug(1, "Reach End:", data.reachEnd());

  console.log('Color Set:', colorSet);

  return img;
}
