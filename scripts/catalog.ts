export const DATA_DIR = `${import.meta.dirname}/../data`;
export const REMOVED_URLS_FILE = `${DATA_DIR}/fatwas-removed/urls.txt`;

export const FATWA_MIRRORS = {
  "seekersguidance-hanafi": "seekersguidance.org",
  "seekersguidance-shafii": "seekersguidance.org",
  "seekersguidance-maliki": "seekersguidance.org",
  mathabah: "mathabah.org",
  albalagh: "albalagh.net",
} as const;
