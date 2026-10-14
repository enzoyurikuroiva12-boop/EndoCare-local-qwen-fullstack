import { useMemo, useRef, useState } from "react";
import { Check, Grip, LoaderCircle, Move, X } from "lucide-react";
import "./ProfilePhotoEditor.css";

type ProfilePhotoEditorCopy = {
  title: string;
  helper: string;
  zoom: string;
  horizontal: string;
  vertical: string;
  cancel: string;
  apply: string;
  preparing: string;
};

type ProfilePhotoEditorProps = {
  src: string;
  width: number;
  height: number;
  copy: ProfilePhotoEditorCopy;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

type CropState = {
  centerX: number;
  centerY: number;
  zoom: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
};

const OUTPUT_SIZE = 512;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMetrics(width: number, height: number, zoom: number) {
  const baseSize = Math.min(width, height);
  const cropSize = baseSize / zoom;
  return {
    cropSize,
    minX: cropSize / 2,
    maxX: width - cropSize / 2,
    minY: cropSize / 2,
    maxY: height - cropSize / 2,
  };
}

function percentage(value: number, min: number, max: number) {
  if (max <= min) return 50;
  return ((value - min) / (max - min)) * 100;
}

function positionFromPercentage(value: number, min: number, max: number) {
  if (max <= min) return min;
  return min + ((max - min) * value) / 100;
}

function createCroppedPhoto(src: string, width: number, height: number, crop: CropState) {
  return new Promise<Blob | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const { cropSize, minX, maxX, minY, maxY } = getMetrics(width, height, crop.zoom);
      const centerX = clamp(crop.centerX, minX, maxX);
      const centerY = clamp(crop.centerY, minY, maxY);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return resolve(null);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, centerX - cropSize / 2, centerY - cropSize / 2, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob(resolve, "image/webp", .88);
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export function ProfilePhotoEditor({ src, width, height, copy, saving, onCancel, onConfirm }: ProfilePhotoEditorProps) {
  const [crop, setCrop] = useState<CropState>({ centerX: width / 2, centerY: height / 2, zoom: 1 });
  const [preparing, setPreparing] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const metrics = useMemo(() => getMetrics(width, height, crop.zoom), [width, height, crop.zoom]);

  const updateCrop = (changes: Partial<CropState>) => {
    setCrop((current) => {
      const next = { ...current, ...changes };
      const nextMetrics = getMetrics(width, height, next.zoom);
      return {
        ...next,
        centerX: clamp(next.centerX, nextMetrics.minX, nextMetrics.maxX),
        centerY: clamp(next.centerY, nextMetrics.minY, nextMetrics.maxY),
      };
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (saving || preparing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, centerX: crop.centerX, centerY: crop.centerY };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const stage = event.currentTarget.getBoundingClientRect();
    const scale = stage.width / metrics.cropSize;
    updateCrop({ centerX: drag.centerX - (event.clientX - drag.startX) / scale, centerY: drag.centerY - (event.clientY - drag.startY) / scale });
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const confirmCrop = async () => {
    setPreparing(true);
    const blob = await createCroppedPhoto(src, width, height, crop);
    setPreparing(false);
    if (blob) onConfirm(blob);
  };

  return <section className="profile-photo-editor" aria-label={copy.title}>
    <div className="profile-photo-editor__header"><div><strong>{copy.title}</strong><small>{copy.helper}</small></div><button type="button" className="profile-photo-editor__close" onClick={onCancel} disabled={saving || preparing} aria-label={copy.cancel}><X size={16} /></button></div>
    <div className="profile-photo-editor__stage" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging} role="img" aria-label={copy.helper}>
      <img src={src} alt="" draggable="false" style={{ width: `${(width / metrics.cropSize) * 100}%`, left: "50%", top: "50%", transform: `translate(-${(crop.centerX / width) * 100}%, -${(crop.centerY / height) * 100}%)` }} />
      <span className="profile-photo-editor__guide" aria-hidden="true"><span /></span>
      <span className="profile-photo-editor__drag-hint" aria-hidden="true"><Move size={15} /> <span>{copy.helper}</span></span>
    </div>
    <div className="profile-photo-editor__controls">
      <label><span>{copy.zoom}</span><input type="range" min="1" max="3" step=".01" value={crop.zoom} onChange={(event) => updateCrop({ zoom: Number(event.target.value) })} disabled={saving || preparing} aria-label={copy.zoom} /></label>
      <label><span>{copy.horizontal}</span><input type="range" min="0" max="100" step=".1" value={percentage(crop.centerX, metrics.minX, metrics.maxX)} onChange={(event) => updateCrop({ centerX: positionFromPercentage(Number(event.target.value), metrics.minX, metrics.maxX) })} disabled={saving || preparing} aria-label={copy.horizontal} /></label>
      <label><span>{copy.vertical}</span><input type="range" min="0" max="100" step=".1" value={percentage(crop.centerY, metrics.minY, metrics.maxY)} onChange={(event) => updateCrop({ centerY: positionFromPercentage(Number(event.target.value), metrics.minY, metrics.maxY) })} disabled={saving || preparing} aria-label={copy.vertical} /></label>
    </div>
    <div className="profile-photo-editor__actions"><button type="button" className="profile-photo-editor__cancel" onClick={onCancel} disabled={saving || preparing}><X size={15} />{copy.cancel}</button><button type="button" className="account-primary" onClick={() => void confirmCrop()} disabled={saving || preparing}>{saving || preparing ? <LoaderCircle className="account-spinner" size={15} /> : <Check size={15} />}{saving ? copy.preparing : preparing ? copy.preparing : copy.apply}</button></div>
  </section>;
}

export { getMetrics };
