// ========================== Face Byte ==========================
export const FACING_RIGHT = 1 << 0;
export const FACING_UP = 1 << 1;
export const FACING_LEFT = 1 << 2;
export const FACING_DOWN = 1 << 3;
export const FACING_UPRIGHT = 1 << 4;
export const FACING_UPLEFT = 1 << 5;
export const FACING_DOWNRIGHT = 1 << 6;
export const FACING_DOWNLEFT = 1 << 7;

export const FACING_SIDE = FACING_LEFT | FACING_RIGHT;
export const FACING_UPSIDE = FACING_UPLEFT | FACING_UPRIGHT;
export const FACING_DOWNSIDE = FACING_DOWNLEFT | FACING_DOWNRIGHT;
export const FACING_45S =
  FACING_UPLEFT | FACING_UPRIGHT | FACING_DOWNLEFT | FACING_DOWNRIGHT;
export const FACING_90S = FACING_UP | FACING_DOWN | FACING_LEFT | FACING_RIGHT;

export const FACING_ANY = FACING_45S | FACING_90S;

// ========================= Name Suffix =========================
const SUFFIX_RIGHT = "_right";
const SUFFIX_UP = "_up";
const SUFFIX_LEFT = "_left";
const SUFFIX_DOWN = "_down";
const SUFFIX_UPRIGHT = "_upright";
const SUFFIX_UPLEFT = "_upleft";
const SUFFIX_DOWNRIGHT = "_downright";
const SUFFIX_DOWNLEFT = "_downleft";
const SUFFIX_SIDE = "_side";
const SUFFIX_UPSIDE = "_upside";
const SUFFIX_DOWNSIDE = "_downside";
const SUFFIX_45S = "_45s";
const SUFFIX_90S = "_90s";

const facingList: {
  code: number;
  suffix: string;
}[] = [
    { code: FACING_RIGHT, suffix: SUFFIX_RIGHT },
    { code: FACING_UP, suffix: SUFFIX_UP },
    { code: FACING_LEFT, suffix: SUFFIX_LEFT },
    { code: FACING_DOWN, suffix: SUFFIX_DOWN },
    { code: FACING_UPRIGHT, suffix: SUFFIX_UPRIGHT },
    { code: FACING_UPLEFT, suffix: SUFFIX_UPLEFT },
    { code: FACING_DOWNRIGHT, suffix: SUFFIX_DOWNRIGHT },
    { code: FACING_DOWNLEFT, suffix: SUFFIX_DOWNLEFT },
    { code: FACING_SIDE, suffix: SUFFIX_SIDE },
    { code: FACING_UPSIDE, suffix: SUFFIX_UPSIDE },
    { code: FACING_DOWNSIDE, suffix: SUFFIX_DOWNSIDE },
    { code: FACING_45S, suffix: SUFFIX_45S },
    { code: FACING_90S, suffix: SUFFIX_90S },
  ];

export function getAnimationName(name: string, facingBtye: number) {
  for (let i = 0; i < facingList.length; i += 1) {
    const faceCondition = facingList[i];
    if (faceCondition.code === facingBtye) {
      return `${name}${faceCondition.suffix}`;
    }
  }

  return name;
}

// ============================ Layer ============================
interface Layer { zIndex: number, hash: number, priority?: number }

// 收集图层列表
export class Layers {
  private layers: Layer[];
  private snapshotLayers: Layer[];

  startRecord = () => {
    this.snapshotLayers = [];
  };

  add(zIndex: number, hash: number) {
    this.snapshotLayers.push({ zIndex, hash });
  }

  flushRecord = () => {
    if (!this.layers) {
      // 如果不存在，直接赋值
      this.layers = this.snapshotLayers;
    } else {
      console.log('Layers:', this.layers);
      console.log('Snapshot:', this.snapshotLayers);

      // 如果存在，我们就插值。首先先排个序
      this.layers = this.layers.map((layer, layerIndex) => ({
        ...layer,
        priority: layerIndex,
      }));

      let insertPriority = -100;
      let searchStartIndex = 0;
      this.snapshotLayers.forEach((layer) => {
        const matchIndex = this.layers.findIndex((l, i) => l.hash === layer.hash && i >= searchStartIndex);
        console.log('Index:', matchIndex, insertPriority, searchStartIndex);

        if (matchIndex === -1) {
          this.layers.unshift({
            ...layer,
            priority: insertPriority,
          });

          insertPriority += 0.01;
          searchStartIndex += 1;
        } else {
          searchStartIndex = matchIndex + 1;
          insertPriority = this.layers[matchIndex].priority + 0.01;
        }
      });

      this.layers.sort((a, b) => a.priority - b.priority);

    }


  };

  getList() {
    return this.layers;
  }

  /** 根据 zIndex 获取对应的 timeline */
  getLayerIndex(zIndex: number) {
    return this.getList().findIndex(layer => layer.zIndex === zIndex);
  }
}
