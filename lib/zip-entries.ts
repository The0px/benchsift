import "@tanstack/react-start/server-only";

import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** Bounds each extracted file, so a malformed or hostile archive cannot exhaust memory. */
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;

/**
 * Reads the named files of a ZIP archive (stored or deflated, no ZIP64), as
 * UTF-8 text. Names absent from the archive are absent from the result.
 */
export function readZipTextEntries(archive: Uint8Array, names: readonly string[]): Map<string, string> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const wanted = new Set(names);
  const result = new Map<string, string>();

  let eocd = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");

  for (let n = 0; n < count && offset + 46 <= archive.length; n++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error("Corrupt ZIP directory");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    if (!wanted.has(name) || size > MAX_ENTRY_BYTES) continue;
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new Error("Corrupt ZIP entry");
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const data = archive.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) result.set(name, decoder.decode(data));
    else if (method === 8) result.set(name, decoder.decode(inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES })));
  }
  return result;
}
