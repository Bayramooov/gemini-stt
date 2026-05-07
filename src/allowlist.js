import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PATH = './data/access.json';

const ids = new Set();

export function load() {
  mkdirSync('./data', { recursive: true });
  if (!existsSync(PATH)) writeFileSync(PATH, '[]');
  for (const id of JSON.parse(readFileSync(PATH, 'utf8'))) ids.add(id);
}

function save() {
  writeFileSync(PATH, JSON.stringify([...ids]));
}

export function add(id) {
  ids.add(id);
  save();
}

export function remove(id) {
  ids.delete(id);
  save();
}

export function has(id) {
  return ids.has(id);
}

export function list() {
  return [...ids];
}
