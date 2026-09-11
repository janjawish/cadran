"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  X,
  RotateCcw,
  Aperture,
  ArrowRight,
  ScanLine,
} from "lucide-react";
import { compressPhoto, MAX_PHOTOS } from "@/lib/photos";
import { ErrorNotice } from "./ui";
import type { Photo } from "@/lib/types";
const angles = ["Cadran", "Dos", "Bracelet / boucle", "Papiers"];
function Thumbnail({
  photo,
  onRemove,
}: {
  photo: Photo;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo.blob]);
  return (
    <div className="photo-thumbnail">
      {url && <img src={url} alt={photo.angle} />}
      <span>{photo.angle}</span>
      <button
        type="button"
        aria-label={`Reprendre ou supprimer la photo ${photo.angle}`}
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}
export function PhotoCapture({
  photos,
  onChange,
  screenshots = false,
  disabled = false,
}: {
  photos: Photo[];
  onChange: (p: Photo[]) => void;
  screenshots?: boolean;
  disabled?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [camera, setCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const nativeCamera = useRef<HTMLInputElement>(null);
  const currentPhotos = useRef(photos);
  currentPhotos.current = photos;
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
    setCameraReady(false);
    dialog.current?.close();
  };
  useEffect(
    () => () => stream.current?.getTracks().forEach((t) => t.stop()),
    [],
  );
  async function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    setError("");
    setProcessing(true);
    try {
      const remaining = MAX_PHOTOS - currentPhotos.current.length;
      if (files.length > remaining)
        throw new Error(
          `Vous pouvez conserver ${MAX_PHOTOS} photos par analyse. ${remaining} emplacement(s) disponible(s).`,
        );
      const added: Photo[] = [];
      for (const file of Array.from(files))
        added.push(
          await compressPhoto(
            file,
            screenshots ? "Capture d’annonce" : angles[step],
          ),
        );
      onChange([...currentPhotos.current, ...added]);
      if (!screenshots) setStep(Math.min(3, step + 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setProcessing(false);
      if (upload.current) upload.current.value = "";
      if (nativeCamera.current) nativeCamera.current.value = "";
    }
  }
  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      nativeCamera.current?.click();
      return;
    }
    setCamera(true);
    dialog.current?.showModal();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      if (!dialog.current?.open) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
        setCameraReady(true);
      }
    } catch {
      stop();
      setError(
        "Caméra indisponible ou accès refusé. Utilisez « Appareil photo système » ou importez une image.",
      );
    }
  }
  async function takePhoto() {
    if (!video.current || !cameraReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.9),
    );
    stop();
    if (blob) {
      navigator.vibrate?.(25);
      await addFiles([new File([blob], "capture.jpg", { type: "image/jpeg" })]);
    }
  }
  return (
    <div className="photo-capture">
      <input
        ref={upload}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      <input
        ref={nativeCamera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      {!screenshots && (
        <div className="scan-steps">
          {angles.map((a, i) => (
            <button
              type="button"
              key={a}
              className={step === i ? "active" : ""}
              disabled={disabled}
              onClick={() => setStep(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {a}
              {photos.some((p) => p.angle === a) && <i />}
            </button>
          ))}
        </div>
      )}
      <div className="capture-surface">
        <div className="capture-corners" />
        <div className="capture-center">
          <div className="watch-guide">
            <ScanLine size={55} strokeWidth={0.6} />
          </div>
          <span className="eyebrow">
            {screenshots
              ? "VOTRE ANNONCE SOUS TOUS LES ANGLES"
              : `0${step + 1} / ${angles[step].toUpperCase()}`}
          </span>
          <h2>
            {screenshots
              ? "Les détails font la différence."
              : step === 0
                ? "Tout commence par un regard."
                : step === 1
                  ? "L’envers révèle l’essentiel."
                  : step === 2
                    ? "Chaque maillon compte."
                    : "Les traces de son histoire."}
          </h2>
          <p>
            {screenshots
              ? "Importez une ou plusieurs captures de l’annonce."
              : step === 0
                ? "Cadran face à vous, lumière naturelle, sans reflet."
                : step === 1
                  ? "Photographiez les gravures et la référence du fond."
                  : step === 2
                    ? "Ajoutez le bracelet, la boucle et leurs marquages."
                    : "Carte de garantie et justificatifs. Masquez vos informations personnelles."}
          </p>
          <div className="button-group">
            {!screenshots && (
              <button
                type="button"
                className="button light"
                onClick={() => void openCamera()}
                disabled={disabled || processing || photos.length >= MAX_PHOTOS}
              >
                <Camera size={18} />
                Prendre une photo
              </button>
            )}
            <button
              type="button"
              className={`button ${screenshots ? "light" : "camera-outline"}`}
              onClick={() => upload.current?.click()}
              disabled={disabled || processing || photos.length >= MAX_PHOTOS}
            >
              <ImagePlus size={18} />
              {processing
                ? "Compression…"
                : screenshots
                  ? "Importer des captures"
                  : "Importer"}
            </button>
          </div>
        </div>
        <div className="capture-footer">
          <span>
            {photos.length} / {MAX_PHOTOS} PHOTOS · JPEG COMPRESSÉ
          </span>
          {!screenshots && (
            <button
              type="button"
              onClick={() => setStep((step + 1) % 4)}
              disabled={disabled}
              className="text-button"
            >
              {step === 3 ? "Revenir au cadran" : "Ignorer cette étape"}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
      {!screenshots && (
        <button
          type="button"
          className="text-button muted"
          disabled={disabled || processing || photos.length >= MAX_PHOTOS}
          onClick={() => nativeCamera.current?.click()}
        >
          <Camera size={14} />
          Appareil photo système
        </button>
      )}
      <ErrorNotice message={error} />
      {photos.length > 0 && (
        <div className="photo-thumbnails">
          {photos.map((p) => (
            <Thumbnail
              key={p.id}
              photo={p}
              onRemove={() =>
                !disabled && onChange(photos.filter((x) => x.id !== p.id))
              }
            />
          ))}
        </div>
      )}
      <dialog ref={dialog} className="camera-dialog" onCancel={() => stop()}>
        <div className="camera-top">
          <span className="eyebrow">{angles[step]}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer la caméra"
            onClick={stop}
          >
            <X />
          </button>
        </div>
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          aria-label="Aperçu de la caméra"
        />
        {camera && (
          <div className="camera-frame">
            <div />
            <p>Positionnez la montre dans le cadre</p>
          </div>
        )}
        <div className="camera-controls">
          <button
            className="icon-button"
            type="button"
            aria-label="Revenir à l’import"
            onClick={stop}
          >
            <RotateCcw />
          </button>
          <button
            type="button"
            className="shutter"
            aria-label="Prendre la photo"
            disabled={!cameraReady}
            onClick={() => void takePhoto()}
          >
            <Aperture size={28} />
          </button>
          <span />
        </div>
      </dialog>
    </div>
  );
}
