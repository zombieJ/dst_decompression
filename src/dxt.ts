import * as jimp from "jimp";
import { BufferData, debug } from "./util";

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parse565(color: number): RGB {
  let value = color;
  const b = (value & ((1 << 5) - 1)) << 3;

  value >>= 5;
  const g = (value & ((1 << 6) - 1)) << 2;

  value >>= 6;
  const r = (value & ((1 << 5) - 1)) << 3;

  return { r, g, b };
}

function blanceColor(color0: RGB, color1: RGB, mul0: number, mul1: number) {
  const sum = mul0 + mul1;
  return {
    r: (color0.r * mul0 + color1.r * mul1) / sum,
    g: (color0.g * mul0 + color1.g * mul1) / sum,
    b: (color0.b * mul0 + color1.b * mul1) / sum,
  };
}

function rgba2hex(r: number, g: number, b: number, a: number) {
  let color = r;
  color = (color << 8) | g;
  color = (color << 8) | b;
  color = (color << 8) | a;
  color = color >>> 0;

  return color;
}

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
  const color0 = parse565(data.readUint16());
  const color1 = parse565(data.readUint16());

  // Build color table
  const colors: RGB[] = [color0, color1];

  // if (color0 <= color1) {
  //   colors[2] = blanceColor(color0, color1, 1, 1);
  //   colors[3] = { r: 0, g: 0, b: 0 };
  // } else {
    colors[2] = blanceColor(color0, color1, 2, 1);
    colors[3] = blanceColor(color0, color1, 1, 2);
  // }

  debug(0, "Colors:", colors);

  // >>> Get cell color
  const colorList: RGB[] = [];
  for (let y = 0; y < 4; y += 1) {
    let value = data.readByte();

    for (let x = 0; x < 4; x += 1) {
      const colorIndex = value & ((1 << 2) - 1);
      const color565 = colors[colorIndex];
      colorList.push(color565);
    }
  }

  debug(0, "Cell Color:", colorList);

  return colorList.map((rgb, index) => {
    const rgba = rgba2hex(rgb.r, rgb.g, rgb.b, alphaList[index]);
    return rgba;
  });
}

export function parseDXT5(buffer: Buffer, width: number, height: number) {
  const data = new BufferData(buffer);
  debug(0, "Buffer Size:", buffer.length, `${buffer.length / 8}`);

  const img = new jimp(width, height);
  img.quality(100);

  try {
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < height; x += 4) {
        // Fill 4 * 4
        const blockColors = parseBlock(data);
        blockColors.forEach((hexColor, index) => {
          const px = x + (index % 4);
          const py = y + Math.floor(index / 4);
          img.setPixelColor(hexColor, px, py);
        });
      }
    }
  } catch (e) {
    throw e;
  } finally {
  }

  return img;
}
