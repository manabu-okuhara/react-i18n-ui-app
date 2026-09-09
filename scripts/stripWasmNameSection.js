const fs = require('fs');

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error('Usage: node stripWasmNameSection.js <input.wasm> <output.wasm>');
}

const input = fs.readFileSync(inputPath);

if (input.toString('hex', 0, 4) !== '0061736d') {
  throw new Error(`${inputPath} is not a WebAssembly binary.`);
}

function readUnsignedLeb128(buffer, startOffset) {
  let offset = startOffset;
  let value = 0;
  let shift = 0;

  while (offset < buffer.length) {
    const byte = buffer[offset];
    value |= (byte & 0x7f) << shift;
    offset += 1;

    if ((byte & 0x80) === 0) {
      return { value, nextOffset: offset };
    }

    shift += 7;
    if (shift > 35) {
      break;
    }
  }

  throw new Error('Invalid unsigned LEB128 value in WebAssembly binary.');
}

const retainedSections = [input.subarray(0, 8)];
let offset = 8;

while (offset < input.length) {
  const sectionStart = offset;
  const sectionId = input[offset];
  offset += 1;

  const sectionSize = readUnsignedLeb128(input, offset);
  const payloadStart = sectionSize.nextOffset;
  const sectionEnd = payloadStart + sectionSize.value;

  if (sectionEnd > input.length) {
    throw new Error('WebAssembly section extends beyond the end of the binary.');
  }

  let shouldRetain = true;

  if (sectionId === 0) {
    const nameSize = readUnsignedLeb128(input, payloadStart);
    const nameStart = nameSize.nextOffset;
    const nameEnd = nameStart + nameSize.value;
    const customSectionName = input.toString('utf8', nameStart, nameEnd);
    shouldRetain = customSectionName !== 'name';
  }

  if (shouldRetain) {
    retainedSections.push(input.subarray(sectionStart, sectionEnd));
  }

  offset = sectionEnd;
}

fs.writeFileSync(outputPath, Buffer.concat(retainedSections));
