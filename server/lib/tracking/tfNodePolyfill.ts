/**
 * Node 23+ removed util.isNullOrUndefined — tfjs-node 4.22.0 still uses it.
 * https://github.com/tensorflow/tfjs/pull/8425 (merged, not yet released)
 */
import nodeUtil from 'node:util';

const utilRecord = nodeUtil as typeof nodeUtil & {
  isNullOrUndefined?: (value: unknown) => boolean;
  isArray?: (value: unknown) => boolean;
};

if (typeof utilRecord.isNullOrUndefined !== 'function') {
  utilRecord.isNullOrUndefined = (value: unknown) => value === null || value === undefined;
}

if (typeof utilRecord.isArray !== 'function') {
  utilRecord.isArray = Array.isArray;
}
