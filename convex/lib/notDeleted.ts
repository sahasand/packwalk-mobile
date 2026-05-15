export function notDeleted<T extends { isDeleted?: boolean }>(doc: T) {
  return doc.isDeleted !== true;
}

