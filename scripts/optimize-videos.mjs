import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");

const sourcePath = path.join(
  rootDir,
  "media-source",
  "gallery",
  "video-master.mp4",
);

const outputConfigs = [
  {
    label: "mobile",
    outputPath: path.join(rootDir, "public", "gallery", "videoOptimizado.mp4"),
    height: 1280,
    crf: 24,
    preset: "slow",
  },
  {
    label: "desktop",
    outputPath: path.join(rootDir, "public", "gallery", "video.mp4"),
    height: 1600,
    crf: 22,
    preset: "slow",
  },
];

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ensureSource() {
  if (!ffmpegPath) {
    throw new Error("No se encontro ffmpeg-static.");
  }

  if (!existsSync(sourcePath)) {
    throw new Error(
      `No se encontro el video master en ${sourcePath}. Coloca ahi el archivo fuente para generar las variantes.`,
    );
  }
}

function encodeVariant(config) {
  mkdirSync(path.dirname(config.outputPath), { recursive: true });

  const sourceSize = statSync(sourcePath).size;

  console.log(`\nGenerando variante ${config.label}...`);
  console.log(`Fuente: ${formatMegabytes(sourceSize)}`);

  const args = [
    "-y",
    "-i",
    sourcePath,
    "-an",
    "-movflags",
    "+faststart",
    "-vf",
    `fps=30,scale=-2:${config.height}:force_original_aspect_ratio=decrease`,
    "-c:v",
    "libx264",
    "-preset",
    config.preset,
    "-crf",
    String(config.crf),
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "48",
    config.outputPath,
  ];

  const result = spawnSync(ffmpegPath, args, { stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`La compresion de ${config.label} fallo con codigo ${result.status}.`);
  }

  const outputSize = statSync(config.outputPath).size;
  const savings = ((1 - outputSize / sourceSize) * 100).toFixed(1);

  console.log(`Salida: ${formatMegabytes(outputSize)} (${savings}% menos que la fuente)`);
}

try {
  ensureSource();

  for (const config of outputConfigs) {
    encodeVariant(config);
  }

  console.log("\nVideos optimizados correctamente.");
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
