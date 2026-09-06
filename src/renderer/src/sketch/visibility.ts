import { isMark, isWriting, nameable, type SketchObject } from "./model";

export interface HiddenKinds {
  marks: boolean;
  text: boolean;
}

export function visibleObjects(objects: SketchObject[], kinds: HiddenKinds): SketchObject[] {
  return objects.filter(
    (object) =>
      !object.hidden && !(kinds.marks && isMark(object)) && !(kinds.text && isWriting(object)),
  );
}

export function labelsShown(
  objects: SketchObject[],
  ids: string[],
  shown: boolean,
): SketchObject[] {
  const wanted = new Set(ids);
  return objects.map((object) =>
    wanted.has(object.id) ? { ...object, label: { ...object.label, shown } } : object,
  );
}

export function objectsHidden(
  objects: SketchObject[],
  ids: string[],
  hidden: boolean,
): SketchObject[] {
  const wanted = new Set(ids);
  return objects.map((object) => (wanted.has(object.id) ? { ...object, hidden } : object));
}

export function toggledLabels(objects: SketchObject[], selection: string[]): SketchObject[] {
  const able = objects.filter(
    (object) => (!selection.length || selection.includes(object.id)) && nameable(object, objects),
  );
  if (!able.length) return objects;
  return labelsShown(
    objects,
    able.map((object) => object.id),
    !able.every((object) => object.label?.shown),
  );
}
