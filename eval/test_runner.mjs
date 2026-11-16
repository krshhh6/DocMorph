import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd());

class MockImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = '';
    this.width = 0;
    this.height = 0;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._native = null;
  }
  get src() {
    return this._src;
  }
  set src(val) {
    this._src = val;
    let promise;
    if (val.startsWith('blob:') && globalThis._lastBlobBuffer) {
      promise = loadImage(globalThis._lastBlobBuffer);
    } else if (val.startsWith('data:')) {
      const b64 = val.split(',')[1];
      promise = loadImage(Buffer.from(b64, 'base64'));
    } else {
      promise = loadImage(val);
    }
    promise
      .then((loaded) => {
        this.width = loaded.width;
        this.height = loaded.height;
        this.naturalWidth = loaded.width;
        this.naturalHeight = loaded.height;
        this._native = loaded;
        if (this.onload) this.onload();
      })
      .catch((err) => {
        if (this.onerror) this.onerror(err);
      });
  }
}

globalThis.Image = MockImage;
globalThis._blobMap = new Map();
let blobCounter = 0;

globalThis.URL.createObjectURL = function (blob) {
  const id = 'blob:node/' + ++blobCounter;
  globalThis._blobMap.set(id, blob);
  return id;
};

globalThis.URL.revokeObjectURL = function (url) {
  globalThis._blobMap.delete(url);
};

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      let width = 1;
      let height = 1;
      let nativeCanvas = createCanvas(width, height);
      let nativeCtx = nativeCanvas.getContext('2d');

      const canvasWrapper = {
        get width() {
          return width;
        },
        set width(val) {
          width = val;
          nativeCanvas.width = val;
        },
        get height() {
          return height;
        },
        set height(val) {
          height = val;
          nativeCanvas.height = val;
        },
        getContext(type, opts) {
          return {
            drawImage(image, ...args) {
              const actual = image instanceof MockImage ? image._native : image;
              return nativeCtx.drawImage(actual, ...args);
            },
            getImageData(sx, sy, sw, sh) {
              return nativeCtx.getImageData(sx, sy, sw, sh);
            },
          };
        },
        toBlob(callback, type = 'image/png', quality = 0.92) {
          const mime = type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
          const buf = nativeCanvas.toBuffer(mime);
          globalThis._lastBlobBuffer = buf;
          const blob = new Blob([buf], { type: mime });
          callback(blob);
        },
      };
      return canvasWrapper;
    }
    return {};
  },
};

const { auditImageClient } = jiti('./src/forensicsClient.ts');

async function test() {
  const filePath = 'eval/samples/real_camera/oneplus_11r_sample1.jpg';
  const buf = fs.readFileSync(filePath);
  const file = new File([buf], path.basename(filePath), { type: 'image/jpeg' });

  const native = await loadImage(buf);
  const img = new MockImage();
  img.width = native.width;
  img.height = native.height;
  img.naturalWidth = native.width;
  img.naturalHeight = native.height;
  img._native = native;

  const res = await auditImageClient(file, img);
  console.log('Result for real_camera:');
  console.log('  Verdict :', res.verdict);
  console.log('  Risk    :', res.risk);
  console.log('  Summary :', res.summary);
  console.log('  Details :', res.details.map((d) => `${d.test}: ${d.result}`).join(' | '));
}

test().catch(console.error);
